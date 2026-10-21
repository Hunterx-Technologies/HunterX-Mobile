import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { HunterXCard } from '../HunterXCard';
import { DiamondRewardScene } from './diamond/DiamondRewardScene';

// "You've earned a scratch card" reward screen: the diamond reward scene
// (rays, sparkles, text, button) with the HunterX card popping in and floating
// in place of the diamond, plus a reveal sound. The card is display only and
// can't be scratched.
//
// Use <ScratchCardReward /> as a full page, or <ScratchCardRewardModal /> to
// show it over any screen.

// Longest wait for the reveal sound before the card shows without it.
const SOUND_LOAD_TIMEOUT_MS = 800;
// How late the sound may still start after the card appears.
const LATE_SOUND_WINDOW_MS = 600;

export interface ScratchCardRewardProps {
  eyebrow?: string;
  /** Use "\n" for line breaks. */
  title?: string;
  rewardName?: string;
  /** Use "\n" for line breaks. */
  description?: string;
  buttonLabel?: string;
  /** The ✕ button. */
  onClose?: () => void;
  /** The "Got it!" button. */
  onPress?: () => void;
  /** Plays the reveal sound as the card pops in. Defaults to true. */
  sound?: boolean;
}

export const SCRATCH_CARD_REWARD_DEFAULTS = {
  eyebrow: 'Congratulations!',
  title: 'You’ve Earned a\nScratch Card!',
  rewardName: 'HunterX Scratch Card',
  description: 'Your grind is paying off. Keep going for\nrarer rewards and climb the leaderboard!',
  buttonLabel: 'Got it!',
};

export const ScratchCardReward: React.FC<ScratchCardRewardProps> = ({
  eyebrow = SCRATCH_CARD_REWARD_DEFAULTS.eyebrow,
  title = SCRATCH_CARD_REWARD_DEFAULTS.title,
  rewardName = SCRATCH_CARD_REWARD_DEFAULTS.rewardName,
  description = SCRATCH_CARD_REWARD_DEFAULTS.description,
  buttonLabel = SCRATCH_CARD_REWARD_DEFAULTS.buttonLabel,
  onClose,
  onPress,
  sound = true,
}) => {
  const revealSound = useAudioPlayer(require('../../../assets/sounds/card_reveal.mp3'));
  const { isLoaded } = useAudioPlayerStatus(revealSound);
  const [timedOut, setTimedOut] = useState(false);
  const [appearedAt, setAppearedAt] = useState<number | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => { });
    const timeout = setTimeout(() => setTimedOut(true), SOUND_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  // Plays once the card has appeared and the sound is loaded. A sound that
  // loads a moment late still plays, as long as the pop-in is still going.
  useEffect(() => {
    if (!sound || appearedAt === null || !isLoaded) return;
    if (Date.now() - appearedAt > LATE_SOUND_WINDOW_MS) return;
    // Browsers block sound until the page has been tapped once (e.g. right
    // after a refresh); skip it there instead of throwing.
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === false) return;
    try {
      revealSound.seekTo(0).catch(() => { });
      revealSound.play();
    } catch (err) {
      console.warn('Could not play card reveal sound:', err);
    }
  }, [sound, appearedAt, isLoaded, revealSound]);

  return (
    <View style={styles.stage}>
      <DiamondRewardScene
        eyebrow={eyebrow}
        title={title}
        rewardName={rewardName}
        description={description}
        buttonLabel={buttonLabel}
        onClose={onClose}
        onPress={onPress}
        // Waits for the sound so it starts together with the card's pop-in.
        centerReady={!sound || isLoaded || timedOut}
        onCenterAppear={() => setAppearedAt(Date.now())}
        renderCenter={({ width, height }) => (
          <HunterXCard width={width} height={height} showFooter={false} animateGlow />
        )}
      />
    </View>
  );
};

export interface ScratchCardRewardModalProps extends ScratchCardRewardProps {
  visible: boolean;
}

/**
 * Full-screen modal version. The animation and sound replay every time it
 * opens. Android's back button calls `onClose`.
 */
export const ScratchCardRewardModal: React.FC<ScratchCardRewardModalProps> = ({ visible, ...props }) => (
  <Modal
    visible={visible}
    animationType="fade"
    transparent={false}
    statusBarTranslucent={true}
    onRequestClose={props.onClose}
  >
    <ScratchCardReward {...props} />
  </Modal>
);

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#020203',
  },
});
