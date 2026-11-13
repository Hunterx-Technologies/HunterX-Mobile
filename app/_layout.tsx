import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, StyleSheet, View } from 'react-native';
import { Stack, router, usePathname, useSegments } from 'expo-router';
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
import { OfflineNotice } from '@/components/common/OfflineNotice';
import { SwordSplash } from '@/components/common/SwordSplash';
import { GlobalLevelUp } from '@/components/features/levelUp/GlobalLevelUp';
import { GlobalStreakBadge } from '@/components/features/streaks/GlobalStreakBadge';
import { GlobalStreakBreak } from '@/components/features/streaks/GlobalStreakBreak';
import { GlobalReward } from '@/components/features/reward/GlobalReward';
import { preloadPriorityAssets, preloadRemainingAssets } from '@/services/media/preloadAssets';
import { getAvatars } from '@/services/api/avatar.service';
import { captureInstallReferrer } from '@/services/referral/pendingReferral';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUnseenRewardsSync } from '@/hooks/useUnseenRewardsSync';
import { useStreakEventsSync } from '@/hooks/useStreakEventsSync';
import { useLevelUpSync } from '@/hooks/useLevelUpSync';

import { SettingsProvider } from '@/context/SettingsContext';

SplashScreen.preventAutoHideAsync();

// Least time between Health refreshes when the app comes back to the foreground.
const HEALTH_RESUME_REFRESH_MS = 60_000;

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

        // Also reset the page's scroll containers — only elements that
        // actually scroll, not every div in the document.
        const scrollableElements = document.querySelectorAll<HTMLElement>(
          '[data-testid="scroll-view"], [style*="overflow"]'
        );
        scrollableElements.forEach((el) => {
          if (el.scrollTop > 0) el.scrollTop = 0;
        });
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

// Root screens anyone may open signed out: app/index.tsx (undefined),
// invite links, and the not-found page.
const PUBLIC_ROOT_SCREENS = new Set([undefined, 'invite', 'guestpass', '+not-found']);

// A signed-in hunter who hasn't finished onboarding stays in the wizard,
// and a signed-out visitor goes to Login. The (auth)/(onboarding)/(tabs)
// layouts guard themselves; this covers the root screens (notifications,
// rewards, feedback…) reachable by deep link or push notification.
function OnboardingGate() {
  const segments = useSegments();
  const isSignedIn = useAuthStore((s) => s.user !== null);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const answersSaved = useAuthStore((s) => !!s.user?.onboarding_done);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const group = segments[0];

  // undefined = app/index.tsx, which routes by itself.
  const selfGuarded =
    group === undefined || group === '(auth)' || group === '(onboarding)' || group === '(tabs)';
  const target: '/(auth)/login' | '/(onboarding)/name' | '/(onboarding)/ascension' | null =
    isBootstrapping || selfGuarded
      ? null
      : !isSignedIn
        ? PUBLIC_ROOT_SCREENS.has(group)
          ? null
          : '/(auth)/login'
        : !isOnboarded
          ? // Answers saved, Ascension not shown yet → Ascension; else step 1.
            answersSaved
            ? '/(onboarding)/ascension'
            : '/(onboarding)/name'
          : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target]);

  // The redirect runs after this render, so cover the screen until it does —
  // a signed-out or not-yet-onboarded hunter must never see an inner screen.
  if (!target) return null;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />;
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

  // Runs once on app start: what the first screen needs, right away.
  useEffect(() => {
    useAuthStore.getState().restoreSession();
    preloadPriorityAssets();
    // Warms the avatar catalog cache so the user's actual avatar_id resolves
    // to its image on first paint instead of falling back to a generic avatar.
    getAvatars().catch(() => {});
  }, []);

  // Everything else waits for the launch splash to finish — run during it,
  // this work (dozens of image downloads, health queries) made the splash
  // animation stutter on low-end phones.
  const splashDone = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!splashDone.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    splashDone.current = { promise, resolve };
  }
  useEffect(() => {
    if (!showSplash) splashDone.current?.resolve();
  }, [showSplash]);

  useEffect(() => {
    splashDone.current?.promise.then(() => {
      preloadRemainingAssets();
      // Android: an invite code carried through the Play Store install.
      captureInstallReferrer();
    });
  }, []);

  // Health data (steps, calories, etc.) changes outside the app whenever
  // Apple Health / Health Connect records activity while HunterX isn't
  // running. Refresh it here — at the root, not just inside the Metrics
  // screen — so a cold launch or returning from the background always syncs
  // before the user even taps the Metrics tab, instead of only refreshing
  // once they happen to already be looking at it.
  // Coming back to the app refreshes at most once a minute: 'active' also
  // fires after a system dialog or a glance at Notification Centre, and each
  // refresh is several Health queries. The Metrics screen still pulls fresh.
  useEffect(() => {
    let lastRefreshAt = 0;
    const refreshHealthMetrics = () => {
      const { isHealthConnected, timeRange } = useMetricsStore.getState();
      if (!isHealthConnected) return;
      lastRefreshAt = Date.now();
      useMetricsStore.getState().fetchRangeData(timeRange);
      useMetricsStore.getState().syncHealthMetricsIfNeeded();
    };

    // Cold start: wait for the persisted connection state to load first —
    // and for the launch splash to end, so the health queries don't compete
    // with its animation.
    Promise.all([useMetricsStore.getState().initFromStorage(), splashDone.current?.promise]).then(
      refreshHealthMetrics
    );

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && Date.now() - lastRefreshAt >= HEALTH_RESUME_REFRESH_MS) {
        refreshHealthMetrics();
      }
    });
    return () => subscription.remove();
  }, []);

  // The native launch screen stays up until the animated splash is ready to
  // play (SwordSplash onReady), so there's no blank screen between the two.
  // Safety net: hide it anyway a few seconds after fonts load.
  useEffect(() => {
    if (!fontsReady) return;
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 4000);
    return () => clearTimeout(t);
  }, [fontsReady]);

  useEffect(() => {

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
          <OnboardingGate />
          <GlobalLevelUp />
          <GlobalStreakBadge />
          <GlobalReward />
          <GlobalStreakBreak />
          <GlobalToast />
          {showSplash && (
            <SwordSplash
              onReady={() => SplashScreen.hideAsync().catch(() => {})}
              onFinish={() => setShowSplash(false)}
            />
          )}
          {/* After the splash, so the intro animation isn't covered by it. */}
          {!showSplash && <OfflineNotice />}
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

