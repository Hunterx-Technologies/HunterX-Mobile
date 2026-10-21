import React from 'react';
import { Stack, Redirect } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

export default function OnboardingLayout() {
  const { isAuthenticated, isOnboarded, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return null;
  }

  // Only redirect to tabs if user is already authenticated AND has already finished onboarding
  if (isAuthenticated && isOnboarded) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="name" />
      <Stack.Screen name="biometrics" />
      <Stack.Screen name="physical-profile" />
      <Stack.Screen name="motivation" />
      <Stack.Screen name="weakness" />
      <Stack.Screen name="assessment" />
      <Stack.Screen name="time" />
      <Stack.Screen name="oath" />
      <Stack.Screen name="ascension" />
      <Stack.Screen name="index" />
    </Stack>
  );
}
