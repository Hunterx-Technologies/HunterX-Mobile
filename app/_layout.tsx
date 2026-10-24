import { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_600SemiBold_Italic } from '@expo-google-fonts/inter/600SemiBold_Italic';
import { Inter_700Bold_Italic } from '@expo-google-fonts/inter/700Bold_Italic';

import { colors } from '@/theme/colors';
import { useAuthStore } from '@/store/useAuthStore';
import { useMetricsStore } from '@/store/useMetricsStore';
import { GlobalToast } from '@/components/common/GlobalToast';
import { SwordSplash } from '@/components/common/SwordSplash';
import { GlobalLevelUp } from '@/components/features/levelUp/GlobalLevelUp';
import { GlobalStreakBadge } from '@/components/features/streaks/GlobalStreakBadge';
import { GlobalStreakBreak } from '@/components/features/streaks/GlobalStreakBreak';
import { GlobalReward } from '@/components/features/reward/GlobalReward';
import { preloadAppAssets } from '@/services/media/preloadAssets';
import { getAvatars } from '@/services/api/avatar.service';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUnseenRewardsSync } from '@/hooks/useUnseenRewardsSync';
import { useStreakEventsSync } from '@/hooks/useStreakEventsSync';
import { useLevelUpSync } from '@/hooks/useLevelUpSync';

import { SettingsProvider } from '@/context/SettingsContext';

SplashScreen.preventAutoHideAsync();

// Lets the popup window opened for web Google sign-in (services/auth/googleAuthWeb)
// signal completion back to the tab that opened it. No-op on native.
WebBrowser.maybeCompleteAuthSession();

function ScrollToTopOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    try {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
    } catch (_) {}

    const resetScroll = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        if (document.documentElement) {
          document.documentElement.scrollTop = 0;
        }
        if (document.body) {
          document.body.scrollTop = 0;
        }

        // Also reset scroll on all scrollable elements in the page
        const scrollableElements = document.querySelectorAll<HTMLElement>(
          '[data-testid="scroll-view"], [style*="overflow"], div'
        );
        for (let i = 0; i < scrollableElements.length; i++) {
          const el = scrollableElements[i];
          if (el && el.scrollTop > 0) {
            el.scrollTop = 0;
          }
        }
      } catch (_) {}
    };

    resetScroll();
    const rafId = requestAnimationFrame(resetScroll);
    const t1 = setTimeout(resetScroll, 30);
    const t2 = setTimeout(resetScroll, 100);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  return null;
}

function PushNotificationsObserver() {
  usePushNotifications();
  useUnseenRewardsSync();
  useStreakEventsSync();
  useLevelUpSync();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_600SemiBold_Italic,
    Inter_700Bold_Italic,
  });
  // A font that fails to load falls back to the system font; it must never
  // hold the app on the splash screen.
  const fontsReady = fontsLoaded || !!fontError;
  // The animated launch splash plays once per cold start, over the app as it loads.
  const [showSplash, setShowSplash] = useState(true);

  // Runs once on app start — reads the persisted access token and warms image cache
  useEffect(() => {
    useAuthStore.getState().restoreSession();
    preloadAppAssets();
    // Warms the avatar catalog cache so the user's actual avatar_id resolves
    // to its image on first paint instead of falling back to a generic avatar.
    getAvatars().catch(() => {});
  }, []);

  // Health data (steps, calories, etc.) changes outside the app whenever
  // Apple Health / Health Connect records activity while HunterX isn't
  // running. Refresh it here — at the root, not just inside the Metrics
  // screen — so a cold launch or returning from the background always syncs
  // before the user even taps the Metrics tab, instead of only refreshing
  // once they happen to already be looking at it.
  useEffect(() => {
    const refreshHealthMetrics = () => {
      const { isHealthConnected, timeRange } = useMetricsStore.getState();
      if (!isHealthConnected) return;
      useMetricsStore.getState().fetchRangeData(timeRange);
      useMetricsStore.getState().syncHealthMetricsIfNeeded();
    };

    // Cold start: wait for the persisted connection state to load first.
    useMetricsStore.getState().initFromStorage().then(refreshHealthMetrics);

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshHealthMetrics();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'autofill-dark-style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          input:-webkit-autofill,
          input:-webkit-autofill:hover, 
          input:-webkit-autofill:focus, 
          input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 1000px #0C0C0E inset !important;
            -webkit-text-fill-color: #FFFFFF !important;
            caret-color: #FFFFFF !important;
            transition: background-color 5000s ease-in-out 0s;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Root-level provider so every screen — including content rendered inside
          <Modal>, which sits in its own native view hierarchy — reads safe-area
          insets from the same React context instead of each relying on native
          view measurement (unreliable inside Modals). See Screen.tsx. */}
      <SafeAreaProvider>
        <SettingsProvider>
          <StatusBar style="light" />
          <ScrollToTopOnNavigate />
          <PushNotificationsObserver />
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <GlobalLevelUp />
          <GlobalStreakBadge />
          <GlobalReward />
          <GlobalStreakBreak />
          <GlobalToast />
          {showSplash && <SwordSplash onFinish={() => setShowSplash(false)} />}
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

