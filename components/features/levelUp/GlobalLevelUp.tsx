import React, { useEffect, useState } from 'react';
import { useLevelUpStore } from '@/store/useLevelUpStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { registerCelebrationPresenter } from '@/store/useCelebrationStore';
import { LevelUpRewardModal } from './LevelUpReward';
import { DragonStageReveal } from './DragonStageReveal';

/**
 * App-wide level-up screen, opened with showLevelUp(). Mounted once in the
 * root layout. On a rank up with dragon art, the bottom button moves on to
 * the new dragon stage before the screen counts as closed.
 */
export function GlobalLevelUp() {
  const { visible, options, hideLevelUp } = useLevelUpStore();
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const [showingDragon, setShowingDragon] = useState(false);

  // showLevelUp() queues; the celebration queue opens it here when its turn comes.
  useEffect(
    () =>
      registerCelebrationPresenter('levelUp', (queued, done) =>
        useLevelUpStore.getState().showLevelUp({
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
  const { dragonStage, onDone: _onDone, ...screen } = options;

  const finishDragon = () => {
    setShowingDragon(false);
    hideLevelUp();
  };

  return (
    <>
      <LevelUpRewardModal
        {...screen}
        visible={visible && !showingDragon}
        sound={soundEffectsEnabled}
        haptics={hapticsEnabled}
        onClose={hideLevelUp}
        onPress={dragonStage ? () => setShowingDragon(true) : hideLevelUp}
      />
      {dragonStage && (
        <DragonStageReveal
          visible={visible && showingDragon}
          imageUrl={dragonStage.imageUrl}
          name={dragonStage.name}
          message={dragonStage.message}
          buttonLabel={dragonStage.buttonLabel}
          onDone={finishDragon}
        />
      )}
    </>
  );
}
