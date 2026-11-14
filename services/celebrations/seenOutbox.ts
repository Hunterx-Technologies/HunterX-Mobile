import AsyncStorage from '@react-native-async-storage/async-storage';

import { markRewardSeen } from '@/services/api/rewards.service';
import { markLevelUpsSeen, markStreakBadgesSeen } from '@/services/api/user.service';
import { useAuthStore } from '@/store/useAuthStore';

// Celebrations the hunter has already claimed, kept on the device until the
// server confirms them. Claiming a badge, reward card or level-up writes it
// here first, then tells the server (retrying); the unseen lists are
// filtered through it. So a claim whose "seen" call failed — offline, app
// killed straight after — is never shown again, and is sent on the next
// launch or foreground instead.

export type SeenKind = 'streakBadge' | 'reward' | 'levelUp';

type Pending = Record<SeenKind, string[]>;

const KEY_PREFIX = 'hunterx-celebrations-seen-v1:';
const RETRY_DELAYS_MS = [1500, 5000, 15000];

const empty = (): Pending => ({ streakBadge: [], reward: [], levelUp: [] });

let loadedFor: string | null = null;
let loading: Promise<void> | null = null;
let pending: Pending = empty();
let sending: Partial<Record<SeenKind, boolean>> = {};
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

const currentUserId = () => {
  const id = useAuthStore.getState().user?.id;
  return id != null ? String(id) : null;
};

/** Loads the signed-in account's pending claims (once per account). */
function ensureLoaded(): Promise<void> {
  const userId = currentUserId();
  if (!userId) return Promise.resolve();
  if (loadedFor === userId) return loading ?? Promise.resolve();
  loadedFor = userId;
  pending = empty();
  sending = {};
  loading = AsyncStorage.getItem(KEY_PREFIX + userId)
    .then((raw) => {
      if (loadedFor !== userId || !raw) return;
      const saved = JSON.parse(raw) as Partial<Pending>;
      // Merge: claims made while this was loading are kept too.
      for (const kind of Object.keys(pending) as SeenKind[]) {
        pending[kind] = Array.from(new Set([...(saved[kind] ?? []), ...pending[kind]]));
      }
    })
    .catch(() => {});
  return loading;
}

function persist() {
  if (!loadedFor) return;
  AsyncStorage.setItem(KEY_PREFIX + loadedFor, JSON.stringify(pending)).catch(() => {});
}

/**
 * The server refused for good (e.g. 404 "Reward not found"): sending it again
 * can't succeed, so the claim is dropped rather than retried on every launch.
 * Network errors (no status), 5xx, 401, 408 and 429 are retried.
 */
const isPermanent = (err: unknown) => {
  const status = (err as { status?: number } | null)?.status;
  return status != null && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
};

const warn = (kind: SeenKind, err: unknown) =>
  console.warn(`[celebrations] mark ${kind} seen failed:`, err instanceof Error ? err.message : err);

/** Sends `ids`; returns the ones that are settled (sent, or refused for good). Throws if none could be settled. */
const send: Record<SeenKind, (ids: string[]) => Promise<string[]>> = {
  streakBadge: async (ids) => {
    await markStreakBadgesSeen(ids);
    return ids;
  },
  levelUp: async (ids) => {
    await markLevelUpsSeen(ids);
    return ids;
  },
  // One call per card (the endpoint is idempotent), so one bad card doesn't hold up the rest.
  reward: async (ids) => {
    const settled: string[] = [];
    let retry: unknown = null;
    for (const id of ids) {
      try {
        await markRewardSeen(id);
        settled.push(id);
      } catch (err) {
        if (isPermanent(err)) {
          warn('reward', err);
          settled.push(id);
        } else retry = err;
      }
    }
    if (retry) {
      if (settled.length > 0) dropSettled('reward', settled);
      throw retry;
    }
    return settled;
  },
};

function dropSettled(kind: SeenKind, ids: string[]) {
  pending[kind] = pending[kind].filter((id) => !ids.includes(id));
  persist();
}

function scheduleRetry() {
  if (retryTimer || retryAttempt >= RETRY_DELAYS_MS.length) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryAttempt++;
    flushSeenOutbox();
  }, RETRY_DELAYS_MS[retryAttempt]);
}

async function flushKind(kind: SeenKind): Promise<boolean> {
  const ids = pending[kind];
  if (ids.length === 0 || sending[kind]) return true;
  sending[kind] = true;
  const userId = loadedFor;
  let settled = ids;
  try {
    settled = await send[kind](ids);
  } catch (err) {
    if (!isPermanent(err)) {
      warn(kind, err);
      return false;
    }
    // Refused for good: drop it (see isPermanent).
    warn(kind, err);
  } finally {
    sending[kind] = false;
  }
  if (loadedFor !== userId) return true;
  dropSettled(kind, settled);
  // Claimed while that call was in flight: send those too.
  return pending[kind].length > 0 ? flushKind(kind) : true;
}

/** Sends every pending claim. Called after each claim, on launch and on foreground. */
export async function flushSeenOutbox(): Promise<void> {
  await ensureLoaded();
  const results = await Promise.all((Object.keys(pending) as SeenKind[]).map(flushKind));
  if (results.every(Boolean)) retryAttempt = 0;
  else scheduleRetry();
}

/** Records a claim on the device, then tells the server. Never throws. */
export function markCelebrationSeen(kind: SeenKind, ids: string[]): void {
  if (ids.length === 0) return;
  ensureLoaded().then(() => {
    pending[kind] = Array.from(new Set([...pending[kind], ...ids]));
    persist();
    retryAttempt = 0;
    flushSeenOutbox();
  });
}

/** Drops ids already claimed on this device (the server may not know yet). */
export async function withoutClaimed<T>(kind: SeenKind, items: T[], idOf: (item: T) => string): Promise<T[]> {
  await ensureLoaded();
  if (pending[kind].length === 0) return items;
  const claimed = new Set(pending[kind]);
  return items.filter((item) => !claimed.has(idOf(item)));
}

/** On sign-out: forget the in-memory state (the saved copy is per account and is sent on their next sign-in). */
export function resetSeenOutbox() {
  loadedFor = null;
  loading = null;
  pending = empty();
  sending = {};
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  retryAttempt = 0;
}
