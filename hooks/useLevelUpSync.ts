import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';
import { showLevelUpFromApi } from '@/store/useLevelUpStore';
import { fetchPendingLevelUp } from '@/services/api/user.service';

// Foreground refreshes are throttled to one a minute.
const FOREGROUND_THROTTLE_MS = 60 * 1000;
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;

/** Queues the level-up screen for any level-up the user hasn't seen yet. */
export function syncLevelUp(): Promise<void> {
  inFlight ??= fetchPendingLevelUp()
    .then(showLevelUpFromApi)
    .catch((err: unknown) => console.warn('[levelUp] sync failed:', err instanceof Error ? err.message : err))
    .finally(() => {
      lastSyncAt = Date.now();
      inFlight = null;
    });
  return inFlight;
}

/**
 * Mounted once in app/_layout.tsx. A quest completion shows its level-up
 * straight from the response; this covers XP that arrives any other way
 * (an admin approving a proof, a referral bonus) and a screen cut short by
 * closing the app: when signed in and onboarded, and again on foreground.
 */
export function useLevelUpSync() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const ready = !isBootstrapping && userId !== null && isOnboarded;

  useEffect(() => {
    if (!ready) return;
    syncLevelUp();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastSyncAt >= FOREGROUND_THROTTLE_MS) syncLevelUp();
    });
    return () => sub.remove();
  }, [ready]);
}
