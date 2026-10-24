import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';
import { showStreakBreak } from '@/store/useStreakBreakStore';
import { fetchStreakEvents, markStreakEventsSeen } from '@/services/api/tasks.service';
import type { StreakEvent } from '@/types/task';

// Foreground refreshes are throttled to one a minute.
const FOREGROUND_THROTTLE_MS = 60 * 1000;
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;
/** Events already queued this session — each card shows once. */
const queuedIds = new Set<string>();

// Several unseen events (e.g. a life used, then the streak broken the next
// day) become one card: the streak's latest state.
function showEvents(events: StreakEvent[]) {
  const fresh = events.filter((e) => !queuedIds.has(e.id));
  if (fresh.length === 0) return;
  fresh.forEach((e) => queuedIds.add(e.id));

  const ids = fresh.map((e) => e.id);
  const onDone = () => {
    // A failed call just means the card is offered again on a later launch.
    markStreakEventsSeen(ids).catch((err: unknown) =>
      console.warn('[streak] mark seen failed:', err instanceof Error ? err.message : err)
    );
  };

  const broken = [...fresh].reverse().find((e) => e.type === 'STREAK_BROKEN');
  if (broken) {
    showStreakBreak({ livesLeft: 0, livesLost: broken.lives_lost, streakLost: true, streakDays: broken.streak_days, onDone });
    return;
  }
  const last = fresh[fresh.length - 1];
  showStreakBreak({
    livesLeft: last.lives_left,
    livesLost: fresh.reduce((sum, e) => sum + e.lives_lost, 0),
    streakLost: false,
    streakDays: last.streak_days,
    onDone,
  });
}

/** Fetches streak lives spent / streaks broken since the user last looked, and queues the card. */
export function syncStreakEvents(): Promise<void> {
  inFlight ??= fetchStreakEvents()
    .then(showEvents)
    .catch((err: unknown) => console.warn('[streak] events sync failed:', err instanceof Error ? err.message : err))
    .finally(() => {
      lastSyncAt = Date.now();
      inFlight = null;
    });
  return inFlight;
}

/**
 * Mounted once in app/_layout.tsx. The backend decides when a streak life is
 * spent (or the streak breaks) and records it; this shows that once, on any
 * device: when signed in and onboarded, and again when the app returns to
 * the foreground.
 */
export function useStreakEventsSync() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const ready = !isBootstrapping && userId !== null && isOnboarded;

  useEffect(() => {
    if (!ready) return;
    syncStreakEvents();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastSyncAt >= FOREGROUND_THROTTLE_MS) syncStreakEvents();
    });
    return () => sub.remove();
  }, [ready]);
}
