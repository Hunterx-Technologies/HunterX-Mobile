import React, { useCallback } from 'react';
import { Tabs, useFocusEffect, usePathname, useRouter } from 'expo-router';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { fontFamilies } from '@/theme/typography';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

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
          return true; // Blocks native back press from returning to onboarding/auth
        }

        // If on another tab, navigate back to Home tab
        router.navigate('/(tabs)');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [pathname, router])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          { height: 62 + insets.bottom, paddingBottom: Math.max(6, insets.bottom) },
        ],
      }}
    >
      {/* 1. Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemWrapper}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={20}
                color={focused ? '#FFFFFF' : '#71717A'}
              />
              <Text style={[styles.tabLabel, focused && styles.activeTabLabel]}>Home</Text>
            </View>
          ),
        }}
      />

      {/* 2. Analytics */}
      <Tabs.Screen
        name="metrics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemWrapper}>
              <Ionicons
                name={focused ? 'stats-chart' : 'stats-chart-outline'}
                size={20}
                color={focused ? '#FFFFFF' : '#71717A'}
              />
              <Text style={[styles.tabLabel, focused && styles.activeTabLabel]}>Analytics</Text>
            </View>
          ),
        }}
      />

      {/* 3. Leaderboard */}
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Battle',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemWrapper}>
              <MaterialCommunityIcons
                name="sword-cross"
                size={22}
                color={focused ? '#FFFFFF' : '#71717A'}
              />
              <Text
                style={[styles.tabLabel, focused && styles.activeTabLabel]}
                numberOfLines={1}
              >
                Battle
              </Text>
            </View>
          ),
        }}
      />

      {/* 4. Rewards / Inventory */}
      <Tabs.Screen
        name="achievements"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemWrapper}>
              <MaterialCommunityIcons
                name={focused ? 'cube' : 'cube-outline'}
                size={21}
                color={focused ? '#FFFFFF' : '#71717A'}
              />
              <Text style={[styles.tabLabel, focused && styles.activeTabLabel]}>Rewards</Text>
            </View>
          ),
        }}
      />

      {/* 5. Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemWrapper}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={20}
                color={focused ? '#FFFFFF' : '#71717A'}
              />
              <Text style={[styles.tabLabel, focused && styles.activeTabLabel]}>Profile</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#09090B',
    borderTopColor: '#18181B',
    borderTopWidth: 1,
    paddingTop: 6,
    elevation: 8,
  },
  tabItemWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 62,
    height: 48,
  },
  tabLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    color: '#71717A',
    marginTop: 2,
  },
  activeTabLabel: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
  },
});
