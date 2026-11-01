import { Redirect, router } from 'expo-router';

import { useEarnedBadgeCount } from '@/components/features/streaks/StreakBadgesCarousel';
import { StreakBadgeShowcase } from '@/components/features/streaks/StreakBadgeShowcase';
import { useAuth } from '@/hooks/useAuth';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Profile > Badges: the badge vault as a page, to browse earned and locked badges. */
export default function BadgesScreen() {
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const streakDays = user?.currentStreak ?? user?.user_progression?.daily_streak ?? 0;
  const earnedCount = useEarnedBadgeCount(user?.badges, streakDays);

  if (isBootstrapping) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <StreakBadgeShowcase
      browseOnly
      currentIndex={earnedCount}
      // Opens on the latest earned badge, or the first one to earn.
      initialViewIndex={Math.max(0, earnedCount - 1)}
      streakDays={streakDays}
      sound={soundEffectsEnabled}
      haptics={hapticsEnabled}
      closeIcon="chevron-back"
      onClose={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
    />
  );
}
