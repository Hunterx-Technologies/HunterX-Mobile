import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchLeaderboardPage } from '@/services/api/leaderboard.service';
import { showGlobalToast } from '@/store/useToastStore';
import type {
  LeaderboardEmptyState,
  LeaderboardEntry,
  LeaderboardMe,
  LeaderboardScope,
} from '@/types/leaderboard';

const STALE_TIME_MS = 45_000; // 30-60s window
const PAGE_SIZE = 20;
const SCOPES: LeaderboardScope[] = ['global', 'friends'];

type ScopeData = {
  entries: LeaderboardEntry[];
  me: LeaderboardMe | null;
  nextCursor: string | null;
  emptyState: LeaderboardEmptyState;
  fetchedAt: number;
};

type ScopeStatus = {
  isRefreshing: boolean;
  isFetchingMore: boolean;
  error: Error | null;
};

function emptyStatus(): ScopeStatus {
  return { isRefreshing: false, isFetchingMore: false, error: null };
}

// Module-level, keyed per scope — survives tab switches within the app
// session (re-selecting a tab shows its last page instantly) and is
// shared correctly across scopes: scope A's in-flight request can
// never suppress scope B's, because each scope tracks its own status.
const dataCache = new Map<LeaderboardScope, ScopeData>();
const statusCache = new Map<LeaderboardScope, ScopeStatus>(SCOPES.map((s) => [s, emptyStatus()]));

// Subscribers are notified on every cache write so every mounted
// screen re-renders and re-reads the cache for whatever scope it's
// currently showing — there's no per-scope React state to go stale.
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function dedupeByUserId(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const seen = new Set<string>();
  const result: LeaderboardEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.userId)) continue;
    seen.add(entry.userId);
    result.push(entry);
  }
  return result;
}

function setStatus(scope: LeaderboardScope, patch: Partial<ScopeStatus>) {
  statusCache.set(scope, { ...(statusCache.get(scope) ?? emptyStatus()), ...patch });
  notify();
}

// Called when the logged-in user changes (see useLeaderboardScope below)
// so switching accounts on the same device never shows the previous
// user's cached rows/`me` block, even briefly.
export function resetLeaderboardCache() {
  dataCache.clear();
  for (const s of SCOPES) statusCache.set(s, emptyStatus());
  notify();
}

async function refreshScope(scope: LeaderboardScope, opts: { force?: boolean } = {}) {
  const status = statusCache.get(scope) ?? emptyStatus();
  if (status.isRefreshing) return;

  const current = dataCache.get(scope);
  const isFresh = current && Date.now() - current.fetchedAt < STALE_TIME_MS;
  if (isFresh && !opts.force) return;

  const hadDataAlready = Boolean(current && current.entries.length > 0);
  setStatus(scope, { isRefreshing: true, error: null });

  try {
    const page = await fetchLeaderboardPage(scope, null, PAGE_SIZE);
    dataCache.set(scope, {
      entries: dedupeByUserId(page.entries),
      me: page.me,
      nextCursor: page.nextCursor,
      emptyState: page.emptyState,
      fetchedAt: Date.now(),
    });
    setStatus(scope, { isRefreshing: false });
  } catch (err) {
    const e = err instanceof Error ? err : new Error('Failed to load the leaderboard');
    setStatus(scope, { isRefreshing: false, error: e });
    // Background refresh failing while data is already on screen is a
    // toast, not a blocking error state — the user keeps what they had.
    if (hadDataAlready) {
      showGlobalToast("Couldn't refresh the leaderboard", 'error');
    } else {
      notify();
    }
  }
}

async function loadMoreScope(scope: LeaderboardScope) {
  const current = dataCache.get(scope);
  if (!current || !current.nextCursor) return;

  const status = statusCache.get(scope) ?? emptyStatus();
  if (status.isFetchingMore) return;

  setStatus(scope, { isFetchingMore: true });

  try {
    const page = await fetchLeaderboardPage(scope, current.nextCursor, PAGE_SIZE);
    const merged = dedupeByUserId([...current.entries, ...page.entries]);
    dataCache.set(scope, {
      entries: merged,
      me: current.me, // `me` only comes back on the first page — keep what we have
      nextCursor: page.nextCursor,
      emptyState: merged.length > 0 ? null : current.emptyState,
      fetchedAt: current.fetchedAt,
    });
    setStatus(scope, { isFetchingMore: false });
  } catch {
    setStatus(scope, { isFetchingMore: false });
    showGlobalToast("Couldn't load more of the leaderboard", 'error');
  }
}

// Tracks whose data the cache currently holds, across the whole app
// session (not per hook instance) — a second account logging in on the
// same device must never see the first account's cached rows.
let lastSeenUserId: string | null | undefined;

export function useLeaderboardScope(scope: LeaderboardScope, userId?: string | null) {
  // Forces a re-render on every cache write so this always reflects the
  // *current* scope's latest data/status — switching tabs re-reads the
  // cache immediately instead of waiting on a fetch or a stale mirror.
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (userId === undefined) return; // caller didn't opt into this check
    if (lastSeenUserId !== undefined && lastSeenUserId !== userId) {
      resetLeaderboardCache();
    }
    lastSeenUserId = userId;
  }, [userId]);

  const data = dataCache.get(scope);
  const status = statusCache.get(scope) ?? emptyStatus();

  const refresh = useCallback((opts: { force?: boolean } = {}) => refreshScope(scope, opts), [scope]);
  const loadMore = useCallback(() => loadMoreScope(scope), [scope]);

  // First-ever view of this scope (no cache yet) — load immediately.
  useEffect(() => {
    if (!dataCache.get(scope)) {
      refreshScope(scope);
    }
  }, [scope]);

  // Revalidate in the background on screen focus, honoring staleTime —
  // cached data (if any) stays on screen the whole time. Only fires on
  // this screen gaining focus (e.g. switching back from another tab),
  // not on the internal Global/Friends pill switch.
  useFocusEffect(
    useCallback(() => {
      refreshScope(scope);
    }, [scope])
  );

  return {
    entries: data?.entries ?? [],
    me: data?.me ?? null,
    emptyState: data?.emptyState ?? null,
    nextCursor: data?.nextCursor ?? null,
    isInitialLoading: !data && status.isRefreshing,
    isRefreshing: status.isRefreshing,
    isFetchingMore: status.isFetchingMore,
    error: status.error,
    loadMore,
    refresh: () => refresh({ force: true }),
  };
}
