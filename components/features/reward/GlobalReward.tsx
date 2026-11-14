import React, { useEffect, useRef, useState } from 'react';
import { router, type Href } from 'expo-router';
import { registerCelebrationPresenter, whenCelebrationsIdle } from '@/store/useCelebrationStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { markCelebrationSeen } from '@/services/celebrations/seenOutbox';
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
    // Once only: a double tap, or ✕ and the button together, must not
    // claim it twice or open the wallet twice.
    const done = doneRef.current;
    if (!done) return;
    doneRef.current = null;
    setVisible(false);
    // Kept on the device until the server confirms, so it never replays.
    markCelebrationSeen('reward', [reward.id]);
    done();
    // After whatever comes next (e.g. the level-up), not underneath it.
    if (openWallet) {
      const href = `/rewards?focus=${reward.id}` as Href;
      whenCelebrationsIdle(() => router.push(href));
    }
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
