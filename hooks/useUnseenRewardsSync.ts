import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';
import { showReward } from '@/store/useCelebrationStore';
import { fetchUnseenRewards } from '@/services/api/rewards.service';

// Foreground refreshes are throttled to one a minute.
const FOREGROUND_THROTTLE_MS = 60 * 1000;
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;

/**
 * Queues every reward card the user hasn't been shown yet. Duplicates (e.g.
 * a card also in the quest-completion response) are dropped by the queue.
 */
export function syncUnseenRewards(): Promise<void> {
  inFlight ??= fetchUnseenRewards()
    .then((rewards) => rewards.forEach(showReward))
    .catch((err: unknown) => console.warn('[rewards] unseen sync failed:', err instanceof Error ? err.message : err))
    .finally(() => {
      lastSyncAt = Date.now();
      inFlight = null;
    });
  return inFlight;
}

/**
 * Mounted once in app/_layout.tsx. Replays unseen rewards once signed in and
 * onboarded (so a celebration cut short by killing the app comes back), and
 * again when the app returns to the foreground.
 */
export function useUnseenRewardsSync() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const ready = !isBootstrapping && userId !== null && isOnboarded;

  useEffect(() => {
    if (!ready) return;
    syncUnseenRewards();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastSyncAt >= FOREGROUND_THROTTLE_MS) syncUnseenRewards();
    });
    return () => sub.remove();
  }, [ready]);
}
