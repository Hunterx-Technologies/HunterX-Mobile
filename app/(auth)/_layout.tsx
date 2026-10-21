import React, { useCallback } from 'react';
import { Stack, Redirect, useFocusEffect, usePathname } from 'expo-router';
import { BackHandler } from 'react-native';

import { useAuth } from '@/hooks/useAuth';

export default function AuthLayout() {
  const { isAuthenticated, isOnboarded, isBootstrapping } = useAuth();
  const pathname = usePathname();

  // Hardware back button handler to prevent navigating back into authenticated screens from auth pages
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Intercept back press on auth root screens (login, etc.) so it doesn't pop back to tabs or profile
        if (
          pathname === '/login' ||
          pathname === '/(auth)/login' ||
          pathname === '/(auth)' ||
          pathname.includes('login')
        ) {
          return true; // Intercept & block back press
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [pathname])
  );

  if (isBootstrapping) {
    return null;
  }

  // If user is already authenticated, prevent them from accessing login/auth screens
  if (isAuthenticated) {
    if (!isOnboarded) {
      return <Redirect href="/(onboarding)/name" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="login" options={{ gestureEnabled: false }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="recovery-sent" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-otp" />
    </Stack>
  );
}
