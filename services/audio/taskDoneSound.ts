import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/store/useSettingsStore';

let taskDoneSound: AudioPlayer | null = null;

function getTaskDoneSound(): AudioPlayer {
  if (!taskDoneSound) {
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
    taskDoneSound = createAudioPlayer(require('@/assets/sounds/done.m4a'));
    taskDoneSound.volume = 1.0;
  }
  return taskDoneSound;
}

/**
 * Preload done.m4a so that playback has zero decoding delay
 * and triggers instantaneously alongside haptics.
 */
export async function preloadTaskDoneSound(): Promise<void> {
  try {
    getTaskDoneSound();
  } catch (err) {
    console.warn('[TaskDoneSound] Preload error:', err);
  }
}

/**
 * Plays done.m4a with ultra-snappy zero-latency playback
 * tightly coupled with haptic feedback for done, completed, and partial task states.
 */
export async function playTaskDoneSound(
  type: 'done' | 'completed' | 'partial' = 'completed'
): Promise<void> {
  const { soundEffectsEnabled, hapticsEnabled } = useSettingsStore.getState();

  // 1. Ultra snappy immediate haptic feedback (if enabled)
  if (hapticsEnabled) {
    try {
      if (type === 'partial') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (_) {}
  }

  // 2. Zero-latency sound playback (if enabled)
  if (!soundEffectsEnabled) return;
  try {
    const player = getTaskDoneSound();
    await player.seekTo(0).catch(() => {});
    player.play();
  } catch (err) {
    console.warn('[TaskDoneSound] Play error:', err);
  }
}
