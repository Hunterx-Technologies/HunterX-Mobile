import React, { useCallback, useEffect } from 'react';
import { Tabs, useFocusEffect, usePathname, useRouter, Redirect } from 'expo-router';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { colors } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';
import { confirmExitApp } from '@/utils/confirmExitApp';
import { useFriendsStore } from '@/store/useFriendsStore';

// How often waiting friend requests are checked while the app is open.
const FRIEND_REQUEST_POLL_MS = 60_000;
// A tab switch only re-checks if the last check is older than this.
const FRIEND_REQUEST_TAB_SWITCH_MS = 15_000;

export default function TabsLayout() {
  const { isAuthenticated, isOnboarded, isBootstrapping } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  // A dot on Battles while friend requests are waiting (the Friends pill
  // inside shows the count).
  const hasFriendRequests = useFriendsStore((s) => s.requests.length > 0);
  // Loaded here (not only on Leaderboard) so the dot shows from launch.
  // Pushes can't be relied on to update it while the app is open: the server
  // holds friend-request pushes in quiet hours (22:00-07:00) and sends one
  // per sender per day. So it's also checked every minute while the app is in
  // the foreground, on a tab switch (at most every 15s), and when the app
  // comes back.
  const signedIn = isAuthenticated && isOnboarded && !isBootstrapping;
  useEffect(() => {
    if (!signedIn) return;
    const { loadRequests } = useFriendsStore.getState();
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      loadRequests();
      timer = setInterval(loadRequests, FRIEND_REQUEST_POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [signedIn]);
  useEffect(() => {
    if (signedIn) useFriendsStore.getState().loadRequests({ maxAgeMs: FRIEND_REQUEST_TAB_SWITCH_MS });
  }, [signedIn, pathname]);

  // Hardware back button handler to prevent back navigation to auth/onboarding screens
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // If on the Home tab, intercept back press so it never goes back to login/onboarding
        if (
          pathname === '/(tabs)' ||
          pathname === '/(tabs)/' ||
          pathname === '/(tabs)/index' ||
          pathname === '/'
        ) {
          // Never go back to login/onboarding; ask whether to close the app.
          confirmExitApp();
          return true;
        }

        // If on another tab (Profile, Battles, Inventory), navigate back to Home tab
        router.navigate('/(tabs)');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [pathname, router])
  );

  // Auth Guard: Redirect unauthenticated users immediately to login
  if (isBootstrapping) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isOnboarded) {
    return <Redirect href="/(onboarding)/name" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // A tab you've left stops re-rendering (and its animations stop
        // drawing) until you come back; timers and store updates still run,
        // so it shows the latest state on return. Big win on low-end phones.
        freezeOnBlur: true,
        // Bar height + bottom padding grow with the device's own inset so the
        // bar's background actually reaches the bottom edge (home indicator /
        // gesture bar area) instead of leaving a gap that falls back to the
        // default system black there.
        tabBarStyle: [styles.tabBar, { height: 64 + insets.bottom, paddingBottom: 8 + insets.bottom }],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Ionicons name="home-sharp" size={20} color={focused ? '#FE5B01' : '#71717A'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="metrics"
        options={{
          title: 'Metrics',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Ionicons name="stats-chart" size={20} color={focused ? '#FE5B01' : '#71717A'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Battles',
          tabBarAccessibilityLabel: hasFriendRequests ? 'Battles, friend requests waiting' : 'Battles',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <MaterialCommunityIcons name="sword-cross" size={22} color={focused ? '#FE5B01' : '#71717A'} />
              {hasFriendRequests && <View style={styles.requestDot} />}
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Ionicons name="person-outline" size={20} color={focused ? '#FE5B01' : '#71717A'} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopColor: '#18181B',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FE5B01',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  activeIconContainer: {
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#3F3F46',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
});
