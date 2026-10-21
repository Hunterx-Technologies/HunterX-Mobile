import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/types/user';
import { showStreakBreak } from '@/store/useStreakBreakStore';

const storageKey = (userId: string) => `hx_streak_lives_${userId}`;

interface Seen {
  lives: number;
  streak: number;
}

/**
 * Compares the user's streak lives with the last ones this device saw and
 * shows the "streak life lost" card when one was used (or the streak ended).
 * The first time, it only remembers the current value.
 */
export function useStreakBreakWatcher(user: User | null | undefined) {
  const userId = user?.id;
  const lives = user?.user_progression?.streak_lives;
  const streak = user?.currentStreak ?? user?.user_progression?.daily_streak ?? 0;

  useEffect(() => {
    if (!userId || typeof lives !== 'number') return;
    let cancelled = false;

    (async () => {
      let seen: Seen | null = null;
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        seen = raw ? JSON.parse(raw) : null;
      } catch {
        seen = null;
      }
      if (cancelled) return;

      if (seen) {
        if (lives < seen.lives) {
          // A life was used; at 0 the streak is gone.
          showStreakBreak({
            livesLeft: lives,
            livesLost: seen.lives - lives,
            streakDays: lives > 0 ? streak : seen.streak,
          });
        } else if (seen.streak >= 2 && streak < seen.streak) {
          // The streak reset without lives dropping (e.g. lives refilled
          // after the break): show the burn-out.
          showStreakBreak({ livesLeft: 0, streakDays: seen.streak });
        }
      }

      AsyncStorage.setItem(storageKey(userId), JSON.stringify({ lives, streak } satisfies Seen)).catch(() => {});
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, lives, streak]);
}
