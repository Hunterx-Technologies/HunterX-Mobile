import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { useSettingsStore } from '@/store/useSettingsStore';

// Short click played alongside the haptic tick on the onboarding scales
// (age ruler, height ruler, weight dial).
//
// Scrolling a ruler can fire a tick every few milliseconds, so:
// - a small pool of players is rotated, so a new tick never has to wait for
//   (or cut off) the previous one mid-play;
// - ticks closer together than MIN_INTERVAL_MS are dropped, so a fast fling
//   sounds like rapid clicks instead of a buzz.

const POOL_SIZE = 4;
const MIN_INTERVAL_MS = 35;
const VOLUME = 0.5;

let pool: AudioPlayer[] = [];
let next = 0;
let lastPlayedAt = 0;

function getPool(): AudioPlayer[] {
  if (pool.length === 0) {
    // Mix with whatever is playing (e.g. the user's music) instead of pausing it.
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    for (let i = 0; i < POOL_SIZE; i++) {
      const player = createAudioPlayer(require('@/assets/sounds/scale_tick.m4a'));
      player.volume = VOLUME;
      pool.push(player);
    }
  }
  return pool;
}

/** Load the tick players up front so the first tick has no decoding delay. */
export function preloadTickSound(): void {
  try {
    getPool();
  } catch (err) {
    console.warn('[TickSound] Preload error:', err);
  }
}

export function playTickSound(): void {
  if (!useSettingsStore.getState().soundEffectsEnabled) return;

  const now = Date.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return;
  lastPlayedAt = now;

  try {
    const players = getPool();
    const player = players[next];
    next = (next + 1) % players.length;
    player.seekTo(0).catch(() => {});
    player.play();
  } catch (err) {
    console.warn('[TickSound] Play error:', err);
  }
}

/** Free the players once the scales are off screen. */
export function releaseTickSound(): void {
  for (const player of pool) {
    try {
      // remove() only unregisters the player on Android; release() frees it.
      player.remove();
      player.release();
    } catch {}
  }
  pool = [];
  next = 0;
}
