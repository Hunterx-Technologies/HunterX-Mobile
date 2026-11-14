import { useEffect } from 'react';

import { syncLevelUp } from '@/hooks/useLevelUpSync';
import { syncStreakBadges } from '@/hooks/useStreakBadgeSync';
import { syncUnseenRewards } from '@/hooks/useUnseenRewardsSync';
import { useAuthStore } from '@/store/useAuthStore';
import { setCelebrationHold } from '@/store/useCelebrationStore';

// Longest the first celebration waits for the other lists to arrive.
const STARTUP_WAIT_MS = 5000;

/**
 * Mounted once in app/_layout.tsx. On app open, what's still unclaimed
 * (badge, reward cards, level-up) arrives from three separate requests in
 * any order; the queue is held until all three have answered (or
 * STARTUP_WAIT_MS passed), so they play in order — badge → reward →
 * level-up — instead of whichever request finished first.
 */
export function useCelebrationStartupHold() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const ready = !isBootstrapping && userId !== null && isOnboarded;

  useEffect(() => {
    if (!ready) return;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      setCelebrationHold('startup', false);
    };
    setCelebrationHold('startup', true);
    const timer = setTimeout(release, STARTUP_WAIT_MS);
    // Each sync shares a request already in flight, and never rejects.
    Promise.all([syncStreakBadges(), syncUnseenRewards(), syncLevelUp()]).then(release);
    return () => {
      clearTimeout(timer);
      release();
    };
  }, [ready, userId]);
}
