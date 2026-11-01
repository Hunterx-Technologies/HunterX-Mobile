import { resetCelebrations } from '@/store/useCelebrationStore';
import { useLevelUpStore } from '@/store/useLevelUpStore';
import { useMetricsStore } from '@/store/useMetricsStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useStreakBadgeStore } from '@/store/useStreakBadgeStore';
import { useStreakBreakStore } from '@/store/useStreakBreakStore';

/**
 * Clears everything that belongs to the signed-in account, on sign-out or
 * when the session ends, so the next account on this device starts clean:
 * pending celebrations, the inbox badge, the onboarding answers, and the
 * health connection (otherwise the next account would sync this device's
 * health data straight away). Device preferences (sound, haptics) stay.
 */
export function resetUserState() {
  resetCelebrations();
  useLevelUpStore.setState({ visible: false, options: null });
  useStreakBadgeStore.setState({ visible: false, options: null, earnedIds: [], landing: null });
  useStreakBreakStore.setState({ visible: false, options: null, pillLandedAt: null });
  useNotificationStore.getState().setUnreadCount(0);
  useOnboardingStore.getState().resetOnboarding();
  if (useMetricsStore.getState().isHealthConnected) {
    useMetricsStore.getState().disconnectProvider();
  }
}
