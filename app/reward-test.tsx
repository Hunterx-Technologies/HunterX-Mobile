import React from 'react';
import { useRouter } from 'expo-router';
import { ScratchCardReward } from '../components/features/reward/ScratchCardReward';

export default function RewardTestScreen() {
  const router = useRouter();

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
