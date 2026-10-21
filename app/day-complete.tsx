import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useSettingsStore } from '@/store/useSettingsStore';
import { DayCompleteCelebration } from '../components/features/streaks/DayCompleteCelebration';

// Day complete page: /day-complete?streak=30&xp=25
export default function DayCompleteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ streak?: string; xp?: string }>();
  const soundEffectsEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const streak = Number(params.streak) || user?.currentStreak || user?.user_progression?.daily_streak || 1;
  const xp = params.xp ? Number(params.xp) : undefined;

  const leave = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <DayCompleteCelebration
      streakDays={streak}
      xp={xp}
      weekStatus={user?.week_status}
      sound={soundEffectsEnabled}
      haptics={hapticsEnabled}
      onContinue={leave}
    />
  );
}
