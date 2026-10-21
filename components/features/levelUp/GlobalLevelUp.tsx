import React from 'react';
import { useLevelUpStore } from '@/store/useLevelUpStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { LevelUpRewardModal } from './LevelUpReward';

/** App-wide level-up screen, opened with showLevelUp(). Mounted once in the root layout. */
export function GlobalLevelUp() {
  const { visible, options, hideLevelUp } = useLevelUpStore();
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  if (!options) return null;

  return (
    <LevelUpRewardModal
      {...options}
      visible={visible}
      sound={soundEffectsEnabled}
      haptics={hapticsEnabled}
      onClose={hideLevelUp}
      onPress={hideLevelUp}
    />
  );
}
