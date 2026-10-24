import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { showStreakBadge } from '@/store/useStreakBadgeStore';
import { fetchUnseenStreakBadges, markStreakBadgesSeen, type UnseenStreakBadge } from '@/services/api/user.service';
import { STREAK_BADGES_DATA } from '@/components/features/streaks/StreakBadgesCarousel';

// Foreground refreshes are throttled to one a minute.
const FOREGROUND_THROTTLE_MS = 60 * 1000;
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;
let syncAgain = false;
/** Badges already queued this session — each popup shows once. */
const queuedIds = new Set<string>();

const markSeen = (ids: string[]) =>
  markStreakBadgesSeen(ids).catch((err: unknown) =>
    // A failed call just means the popup is offered again later.
    console.warn('[streakBadge] mark seen failed:', err instanceof Error ? err.message : err)
  );

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
 * runs again after it, so a badge earned just now is never missed.
 */
export function syncStreakBadges(): Promise<void> {
  if (inFlight) {
    syncAgain = true;
    return inFlight;
  }
  inFlight = fetchUnseenStreakBadges()
    .then(showBadges)
    .catch((err: unknown) => console.warn('[streakBadge] sync failed:', err instanceof Error ? err.message : err))
    .finally(() => {
      lastSyncAt = Date.now();
      inFlight = null;
      if (syncAgain) {
        syncAgain = false;
        syncStreakBadges();
      }
    });
  return inFlight;
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
