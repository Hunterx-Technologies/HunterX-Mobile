import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store/useSettingsStore';
import { devWarn } from '@/services/health/devLog';

let globalIntroSound: AudioPlayer | null = null;
let audioModeReady: Promise<void> | null = null;
let hapticTimers: any[] = [];

// How long playIntroAudio waits for intro.mp3 to finish loading before
// playing anyway (it is ~130 KB and local, so this is a safety net).
const LOAD_TIMEOUT_MS = 1500;

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

// The audio session must be configured before playback starts (the old
// expo-av version awaited this). Cached so preload and play share one call.
function ensureAudioMode(): Promise<void> {
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(
      () => {}
    );
  }
  return audioModeReady;
}

function loadIntroSound(): AudioPlayer {
  const player = createAudioPlayer(require('@/assets/sounds/intro.mp3'));
  player.volume = 1.0;

  // Like the original expo-av version: free the player once the intro has
  // played through, so the next play starts from a fresh one.
  const sub = player.addListener('playbackStatusUpdate', (status) => {
    if (!status.didJustFinish) return;
    sub.remove();
    clearIntroHaptics();
    if (globalIntroSound === player) globalIntroSound = null;
    player.remove();
    player.release();
  });

  return player;
}

/** Resolves once the player has decoded its source, or after a timeout. */
function waitUntilLoaded(player: AudioPlayer): Promise<void> {
  if (player.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(done, LOAD_TIMEOUT_MS);
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded) done();
    });
    function done() {
      clearTimeout(timeout);
      sub.remove();
      resolve();
    }
  });
}

/**
 * Preload intro sound into memory for zero-delay instant playback
 */
export async function preloadIntroAudio(): Promise<void> {
  if (globalIntroSound) return;
  try {
    await ensureAudioMode();
    if (!globalIntroSound) globalIntroSound = loadIntroSound();
  } catch (err) {
    devWarn('Error preloading intro audio:', err);
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

    await ensureAudioMode();
    if (!globalIntroSound) {
      globalIntroSound = loadIntroSound();
    }
    const player = globalIntroSound;
    await waitUntilLoaded(player);
    if (player.currentTime > 0) {
      await player.seekTo(0).catch(() => {});
    }
    player.play();
    return player;
  } catch (err) {
    devWarn('Error playing intro audio:', err);
    return null;
  }
}

export async function stopIntroAudio(): Promise<void> {
  try {
    clearIntroHaptics();
    if (globalIntroSound) {
      const player = globalIntroSound;
      globalIntroSound = null;
      player.pause();
      player.remove();
      player.release();
    }
  } catch (err) {
    devWarn('Error stopping intro audio:', err);
  }
}
