import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store/useSettingsStore';

let globalIntroSound: AudioPlayer | null = null;
let hapticTimers: any[] = [];

export function clearIntroHaptics(): void {
  hapticTimers.forEach((timer) => clearTimeout(timer));
  hapticTimers = [];
}

export function triggerIntroHaptics(): void {
  clearIntroHaptics();
  if (!useSettingsStore.getState().hapticsEnabled) return;

  // 1. Initial surge strike (0ms)
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

  // 2. Waveform-synchronized rhythmic pulses matching the intro swell
  const sequence: { delay: number; style: Haptics.ImpactFeedbackStyle }[] = [
    { delay: 90, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 300, style: Haptics.ImpactFeedbackStyle.Heavy },
    { delay: 550, style: Haptics.ImpactFeedbackStyle.Medium },
    { delay: 850, style: Haptics.ImpactFeedbackStyle.Light },
    { delay: 1200, style: Haptics.ImpactFeedbackStyle.Light },
  ];

  sequence.forEach(({ delay, style }) => {
    const timer = setTimeout(() => {
      if (useSettingsStore.getState().hapticsEnabled) {
        Haptics.impactAsync(style).catch(() => {});
      }
    }, delay);
    hapticTimers.push(timer);
  });
}

function loadIntroSound(): AudioPlayer {
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
  const player = createAudioPlayer(require('@/assets/sounds/intro.mp3'));
  player.volume = 1.0;
  return player;
}

/**
 * Preload intro sound into memory for zero-delay instant playback
 */
export async function preloadIntroAudio(): Promise<void> {
  if (globalIntroSound) return;
  try {
    globalIntroSound = loadIntroSound();
  } catch (err) {
    console.log('Error preloading intro audio:', err);
  }
}

export async function playIntroAudio(withHaptics: boolean = true): Promise<AudioPlayer | null> {
  const { soundEffectsEnabled, hapticsEnabled } = useSettingsStore.getState();
  if (!soundEffectsEnabled && !hapticsEnabled) return null;

  try {
    if (withHaptics && hapticsEnabled) {
      triggerIntroHaptics();
    }

    if (!soundEffectsEnabled) return null;

    if (!globalIntroSound) {
      globalIntroSound = loadIntroSound();
    }
    const player = globalIntroSound;
    await player.seekTo(0).catch(() => {});
    player.play();
    return player;
  } catch (err) {
    console.log('Error playing intro audio:', err);
    return null;
  }
}

export async function stopIntroAudio(): Promise<void> {
  try {
    clearIntroHaptics();
    if (globalIntroSound) {
      globalIntroSound.pause();
      globalIntroSound.remove();
      globalIntroSound = null;
    }
  } catch (err) {
    console.log('Error stopping intro audio:', err);
  }
}
