import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useStreakBadgeStore } from '@/store/useStreakBadgeStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { registerCelebrationPresenter } from '@/store/useCelebrationStore';
import { StreakBadgeShowcaseModal } from './StreakBadgeShowcase';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Continue: switch to the home tab under the popup, then find the badge's
// slot in the home "Badges" section for the badge to fly into.
const findHomeSlot = async (badgeId: number) => {
  router.navigate('/(tabs)');
  await wait(320);
  // The home tab may be mounting for the first time; give it a moment.
  for (let i = 0; i < 12 && !useStreakBadgeStore.getState().locator; i++) await wait(100);
  const locate = useStreakBadgeStore.getState().locator;
  return locate ? locate(badgeId) : null;
};

/** App-wide streak badge popup, opened with showStreakBadge(). Mounted once in the root layout. */
export function GlobalStreakBadge() {
  const { visible, options, hideStreakBadge, landBadge } = useStreakBadgeStore();
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  // showStreakBadge() queues; the celebration queue opens it here when its turn comes.
  useEffect(
    () =>
      registerCelebrationPresenter('streakBadge', (queued, done) =>
        useStreakBadgeStore.getState().showStreakBadge({
          ...queued,
          onDone: () => {
            queued.onDone?.();
            done();
          },
        })
      ),
    []
  );

  if (!options) return null;

  return (
    <StreakBadgeShowcaseModal
      {...options}
      visible={visible}
      sound={soundEffectsEnabled}
      haptics={hapticsEnabled}
      // No ✕: an earned badge has to be cracked open, then continued.
      onContinue={hideStreakBadge}
      getIntroSource={(badge) => findHomeSlot(badge.id)}
      getFlightTarget={(badge) => findHomeSlot(badge.id)}
      onLanded={(badge) => landBadge(badge.id)}
    />
  );
}
