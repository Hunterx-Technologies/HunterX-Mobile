import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useStreakBreakStore } from '@/store/useStreakBreakStore';
import { registerCelebrationPresenter } from '@/store/useCelebrationStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { StreakBreakModal } from './StreakBreakCard';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The card's button: switch to the home tab under the card, then find the streak
// pill's flame in the header for the flame to fly into.
const findStreakPill = async () => {
  router.navigate('/(tabs)');
  await wait(320);
  // The home tab may be mounting for the first time; give it a moment.
  for (let i = 0; i < 12 && !useStreakBreakStore.getState().pillLocator; i++) await wait(100);
  const locate = useStreakBreakStore.getState().pillLocator;
  return locate ? locate() : null;
};

/** App-wide "streak life lost" card, opened with showStreakBreak(). Mounted once in the root layout. */
export function GlobalStreakBreak() {
  const { visible, options, hideStreakBreak, landOnPill } = useStreakBreakStore();
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  useEffect(
    () =>
      registerCelebrationPresenter('streakBreak', (next, done) => {
        useStreakBreakStore.getState().presentStreakBreak({
          ...next,
          onDone: () => {
            next.onDone?.();
            done();
          },
        });
      }),
    []
  );

  if (!options || !visible) return null;

  return (
    <StreakBreakModal
      {...options}
      visible={visible}
      sound={soundEffectsEnabled}
      haptics={hapticsEnabled}
      onClose={hideStreakBreak}
      getFlightTarget={findStreakPill}
      onLanded={landOnPill}
    />
  );
}
