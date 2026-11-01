import React from 'react';
import { Redirect, useRouter } from 'expo-router';
import { ScratchCardReward } from '../components/features/reward/ScratchCardReward';

// Developer page — not reachable in release builds.
export default function RewardTestScreen() {
  const router = useRouter();
  if (!__DEV__) return <Redirect href="/" />;

  const leave = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  return (
    <ScratchCardReward
      onClose={leave}
      onPress={() => {
        console.log('[RewardTestScreen] Scratch card reward acknowledged');
        leave();
      }}
    />
  );
}
