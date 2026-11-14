import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { showStreakBadge } from '@/store/useStreakBadgeStore';
import { fetchUnseenStreakBadges, type UnseenStreakBadge } from '@/services/api/user.service';
import { flushSeenOutbox, markCelebrationSeen, withoutClaimed } from '@/services/celebrations/seenOutbox';
import { STREAK_BADGES_DATA } from '@/components/features/streaks/StreakBadgesCarousel';

// Foreground refreshes are throttled to one a minute.
const FOREGROUND_THROTTLE_MS = 60 * 1000;
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;
let syncAgain = false;
/** Badges already queued this session — each popup shows once. */
const queuedIds = new Set<string>();

// Kept on the device until the server confirms, so a claimed badge never replays.
const markSeen = (ids: string[]) => markCelebrationSeen('streakBadge', ids);

function showBadges(badges: UnseenStreakBadge[]) {
  for (const b of badges) {
    if (queuedIds.has(b.id)) continue;
    queuedIds.add(b.id);
    const currentIndex = STREAK_BADGES_DATA.findIndex((d) => d.dayNumber === b.streak_days);
    if (currentIndex < 0) {
      // No artwork for this milestone in this app version: don't keep offering it.
      markSeen([b.id]);
      continue;
    }
    showStreakBadge({ currentIndex, streakDays: b.streak_days, onDone: () => markSeen([b.id]) });
  }
}

/**
 * Fetches streak badges earned but not shown yet and queues their unlock
 * popup (crack the seal, then Continue). A call made while one is running
 * runs again after it, so a badge earned just now is never missed; the
 * returned promise settles once that re-run is done too (never rejects).
 */
export function syncStreakBadges(): Promise<void> {
  if (inFlight) {
    syncAgain = true;
    return inFlight;
  }
  inFlight = (async () => {
    do {
      syncAgain = false;
      flushSeenOutbox();
      try {
        const badges = await fetchUnseenStreakBadges();
        showBadges(await withoutClaimed('streakBadge', badges, (b) => b.id));
      } catch (err) {
        console.warn('[streakBadge] sync failed:', err instanceof Error ? err.message : err);
      }
    } while (syncAgain);
  })().finally(() => {
    lastSyncAt = Date.now();
    inFlight = null;
  });
  return inFlight;
}

// Longest a quest completion waits for its new badge before queueing the rest.
const BADGE_WAIT_MS = 4000;

/**
 * After a completion that reached a streak milestone: fetches the new badge
 * first, then runs `queueRest` (its reward cards, level-up), so they play
 * badge → reward → level-up. A slow or failed fetch only delays the rest by
 * BADGE_WAIT_MS; the badge then comes in behind them.
 */
export function syncStreakBadgesThen(queueRest: () => void) {
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    queueRest();
  };
  setTimeout(run, BADGE_WAIT_MS);
  syncStreakBadges().then(run);
}

/**
 * Used by the home screen, where the popup belongs (Continue flies the badge
 * into its home slot): syncs each time home comes into focus, and when the
 * app returns to the foreground while home is showing.
 */
export function useStreakBadgeSync(enabled: boolean) {
  const focused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (enabled) syncStreakBadges();
      return () => {
        focused.current = false;
      };
    }, [enabled])
  );

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && focused.current && Date.now() - lastSyncAt >= FOREGROUND_THROTTLE_MS) syncStreakBadges();
    });
    return () => sub.remove();
  }, [enabled]);
}
