import React, { useEffect, useRef, useState } from 'react';
import { router, type Href } from 'expo-router';
import { registerCelebrationPresenter } from '@/store/useCelebrationStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { markRewardSeen } from '@/services/api/rewards.service';
import { rewardCelebrationCopy, rewardOccasion, type UserReward } from '@/types/reward';
import { SCRATCH_CARD_REWARD_DEFAULTS, ScratchCardRewardModal } from './ScratchCardReward';

/**
 * App-wide "You've earned a scratch card" screen, opened with showReward()
 * through the celebration queue. Mounted once in the root layout. It only
 * announces the card — the prize is revealed by scratching it in the wallet.
 */
export function GlobalReward() {
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const [reward, setReward] = useState<UserReward | null>(null);
  const [visible, setVisible] = useState(false);
  const doneRef = useRef<(() => void) | null>(null);

  useEffect(
    () =>
      registerCelebrationPresenter('reward', ({ reward: next }, done) => {
        doneRef.current = done;
        setReward(next);
        setVisible(true);
      }),
    []
  );

  if (!reward) return null;
  const copy = rewardCelebrationCopy(reward);

  const close = (openWallet: boolean) => {
    setVisible(false);
    // Fire and forget: a failed call just means it's offered again from the
    // unseen list on a later launch.
    markRewardSeen(reward.id).catch((err: unknown) =>
      console.warn('[GlobalReward] markRewardSeen failed:', err instanceof Error ? err.message : err)
    );
    if (openWallet) router.push(`/rewards?focus=${reward.id}` as Href);
    doneRef.current?.();
    doneRef.current = null;
  };

  return (
    <ScratchCardRewardModal
      visible={visible}
      eyebrow={rewardOccasion(reward) ?? SCRATCH_CARD_REWARD_DEFAULTS.eyebrow}
      title={reward.title ?? copy.title ?? SCRATCH_CARD_REWARD_DEFAULTS.title}
      rewardName={copy.rewardName ?? SCRATCH_CARD_REWARD_DEFAULTS.rewardName}
      description={reward.description ?? copy.description ?? SCRATCH_CARD_REWARD_DEFAULTS.description}
      buttonLabel={copy.buttonLabel ?? SCRATCH_CARD_REWARD_DEFAULTS.buttonLabel}
      sound={soundEffectsEnabled}
      onClose={() => close(false)}
      onPress={() => close(true)}
    />
  );
}
