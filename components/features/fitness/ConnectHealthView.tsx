import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/react/shallow';

import { fontFamilies } from '@/theme/typography';
import { useMetricsStore } from '@/store/useMetricsStore';
import { healthConnectAdapter, appleHealthAdapter } from '@/services/health/healthService';
import { HealthProviderError } from '@/services/health/HealthAdapter';
import { devWarn } from '@/services/health/devLog';
import { OrbitalHealthGraphic } from './OrbitalHealthGraphic';
import { MountainFooterGraphic } from './MountainFooterGraphic';
import { HealthBackgroundDecor } from './HealthBackgroundDecor';
import { GoogleIcon } from '@/components/common/GoogleIcon';
import { useScrollToTopOnFocus } from '@/hooks/useScrollToTopOnFocus';

interface ConnectHealthViewProps {
  onBack?: () => void;
  showBackButton?: boolean;
  onConnectedSuccess?: () => void;
  isModal?: boolean;
}

// Health Connect's Play Store listing; the url parameter opens its onboarding
// once installed (Google's recommended install link).
const HEALTH_CONNECT_STORE_URL =
  'market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding';
const HEALTH_CONNECT_STORE_WEB_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

/** Explains why connecting failed and offers the action that fixes it. */
function showConnectError(provider: 'apple_health' | 'health_connect', e: unknown) {
  const reason = e instanceof HealthProviderError ? e.reason : 'failed';
  const isApple = provider === 'apple_health';

  // Health Connect (or Apple Health) isn't there to connect to.
  if (reason === 'update_required' || reason === 'unavailable') {
    if (isApple) {
      Alert.alert('Apple Health not found', 'Check that Apple Health is available on your iPhone.');
      return;
    }
    // Health Connect supports Android 9 (API 28) and up; on Android 8 there
    // is nothing to install, so don't offer the Play Store.
    const canInstall = typeof Platform.Version === 'number' && Platform.Version >= 28;
    if (!canInstall) {
      Alert.alert('Not supported', 'Health Connect needs Android 9 or newer.');
      return;
    }
    Alert.alert('Health Connect not found', 'Install or update Health Connect, then try again.', [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Install',
        onPress: () =>
          Linking.openURL(HEALTH_CONNECT_STORE_URL).catch(() =>
            Linking.openURL(HEALTH_CONNECT_STORE_WEB_URL).catch(() => {})
          ),
      },
    ]);
    return;
  }

  if (reason === 'denied') {
    Alert.alert(
      'Permission needed',
      isApple ? 'Allow HunterX to read Steps in the Health app.' : 'Allow HunterX to read Steps in Health Connect.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Open settings',
          onPress: () => {
            (isApple ? appleHealthAdapter : healthConnectAdapter).openSettings();
          },
        },
      ]
    );
    return;
  }

  // Unexpected: keep the user-facing text short; details go to the dev log.
  devWarn('[ConnectHealthView] connect failed:', e);
  Alert.alert('Connection failed', "Couldn't connect to your health data. Please try again.");
}

export function ConnectHealthView({
  onBack,
  showBackButton = false,
  onConnectedSuccess,
  isModal = false,
}: ConnectHealthViewProps) {
  const pageScrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(pageScrollRef);
  const insets = useSafeAreaInsets();

  const {
    isHealthConnected,
    connectedProvider,
    connectProvider,
    disconnectProvider,
  } = useMetricsStore(
    useShallow((state) => ({
      isHealthConnected: state.isHealthConnected,
      connectedProvider: state.connectedProvider,
      connectProvider: state.connectProvider,
      disconnectProvider: state.disconnectProvider,
    }))
  );

  const [selectedProvider, setSelectedProvider] = useState<
    'apple_health' | 'health_connect' | null
  >(isHealthConnected ? connectedProvider : null);

  useEffect(() => {
    if (isHealthConnected && connectedProvider) {
      setSelectedProvider(connectedProvider);
    }
  }, [isHealthConnected, connectedProvider]);

  const [connectingProvider, setConnectingProvider] = useState<
    'apple_health' | 'health_connect' | null
  >(null);

  const handleConnect = async (provider: 'apple_health' | 'health_connect') => {
    setSelectedProvider(provider);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isHealthConnected && connectedProvider === provider) {
      Alert.alert(
        'Disconnect Health Data',
        'Are you sure you want to disconnect sync with HunterX?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: () => {
              disconnectProvider();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            },
          },
        ]
      );
      return;
    }

    setConnectingProvider(provider);
    try {
      await connectProvider(provider);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (onConnectedSuccess) {
        onConnectedSuccess();
      }
    } catch (e) {
      showConnectError(provider, e);
    } finally {
      setConnectingProvider(null);
    }
  };

  const hasBack = showBackButton && !!onBack;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Background Topographic Contours, Crimson Aura & Mountain Backdrop */}
      <HealthBackgroundDecor />

      <ScrollView
        ref={pageScrollRef}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: isModal ? insets.top + 8 : Math.max(insets.top, 12),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Bar */}
        {hasBack ? (
          <View style={styles.headerBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : null}
        {/* Prominent Concentric Orbital Graphic */}
        <OrbitalHealthGraphic />

        {/* Scaled Title & Subtitle */}
        <View style={styles.textHeader}>
          <Text style={styles.mainTitle}>Connect Your{'\n'}Health Data</Text>
          <Text style={styles.subTitle}>
            Sync your activity, sleep, and wellness data to unlock powerful insights in HunterX.
          </Text>
        </View>

        {/* Platform Specific Health Provider Option */}
        {Platform.OS === 'ios' ? (
          /* Provider Option: Apple Health (iOS) */
          <TouchableOpacity
            style={[
              styles.providerCardOuter,
              selectedProvider === 'apple_health' && styles.cardActiveShadow,
            ]}
            onPress={() => handleConnect('apple_health')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={
                selectedProvider === 'apple_health'
                  ? ['#2A2E3B', '#1E212C', '#D84315', '#FF5A1E']
                  : ['#22242F', '#181922', '#181922', '#22242F']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={selectedProvider === 'apple_health' ? [0, 0.42, 0.78, 1] : [0, 0.5, 0.5, 1]}
              style={styles.cardBorderGradient}
            >
              <View style={styles.providerCardInner}>
                <View style={styles.providerIconContainer}>
                  <Ionicons name="logo-apple" size={32} color="#FFFFFF" />
                </View>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerSubtitle}>Connect with</Text>
                  <Text style={styles.providerTitle}>Apple Health</Text>
                  <Text style={styles.providerDesc}>
                    Sync your health and fitness data securely using HealthKit.
                  </Text>
                </View>
                <View style={styles.providerAction}>
                  {connectingProvider === 'apple_health' ? (
                    <ActivityIndicator size="small" color="#FE5B01" />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={22}
                      color={selectedProvider === 'apple_health' ? '#FFFFFF' : '#8E8E98'}
                    />
                  )}
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          /* Provider Option: Google Fit / Health Connect (Android) */
          <TouchableOpacity
            style={[
              styles.providerCardOuter,
              selectedProvider === 'health_connect' && styles.cardActiveShadow,
            ]}
            onPress={() => handleConnect('health_connect')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={
                selectedProvider === 'health_connect'
                  ? ['#2A2E3B', '#1E212C', '#D84315', '#FF5A1E']
                  : ['#22242F', '#181922', '#181922', '#22242F']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={selectedProvider === 'health_connect' ? [0, 0.42, 0.78, 1] : [0, 0.5, 0.5, 1]}
              style={styles.cardBorderGradient}
            >
              <View style={styles.providerCardInner}>
                <View style={styles.providerIconContainer}>
                  <GoogleIcon size={30} />
                </View>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerSubtitle}>Connect with</Text>
                  <Text style={styles.providerTitle}>Google Fit / Health Connect</Text>
                  <Text style={styles.providerDesc}>
                    Sync your health and fitness data securely using Health Connect.
                  </Text>
                </View>
                <View style={styles.providerAction}>
                  {connectingProvider === 'health_connect' ? (
                    <ActivityIndicator size="small" color="#FE5B01" />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={22}
                      color={selectedProvider === 'health_connect' ? '#FFFFFF' : '#8E8E98'}
                    />
                  )}
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Feature and Trust Points */}
        <View style={styles.featuresList}>
          {/* Feature 1 */}
          <View style={styles.featureItem}>
            <View style={styles.featureIconBubble}>
              <Ionicons name="stats-chart" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Track what matters</Text>
              <Text style={styles.featureSubtitle}>
                Steps, calories, sleep, heart rate and more.
              </Text>
            </View>
          </View>

          {/* Feature 2 */}
          <View style={styles.featureItem}>
            <View style={styles.featureIconBubble}>
              <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Your data stays private</Text>
              <Text style={styles.featureSubtitle}>
                You're in control. We only access what you allow.
              </Text>
            </View>
          </View>

          {/* Feature 3 */}
          <View style={styles.featureItem}>
            <View style={styles.featureIconBubble}>
              <Ionicons name="star-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Get deeper insights</Text>
              <Text style={styles.featureSubtitle}>
                See your progress and build better habits with HunterX.
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Atmosphere Image with Quote */}
        <MountainFooterGraphic />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050608',
  },
  headerBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
    zIndex: 10,
  },
  headerBarNoBack: {
    justifyContent: 'flex-end',
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  textHeader: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  mainTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 31,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subTitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 14.5,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 330,
  },
  providerCardOuter: {
    borderRadius: 22,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
  },
  cardActiveShadow: {
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 7,
  },
  cardBorderGradient: {
    borderRadius: 22,
    padding: 1.3,
  },
  providerCardInner: {
    backgroundColor: '#121319',
    borderRadius: 20.7,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    position: 'relative',
  },
  providerIconContainer: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  providerInfo: {
    flex: 1,
    paddingRight: 8,
  },
  providerSubtitle: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    color: '#8E8E98',
    marginBottom: 3,
  },
  providerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  providerDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    color: '#7A7A86',
    lineHeight: 17,
  },
  providerAction: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuresList: {
    marginTop: 18,
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#161922',
    borderWidth: 1.2,
    borderColor: '#252936',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  featureTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  featureSubtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.8,
    color: '#8A8F9E',
    lineHeight: 17.5,
  },
  footerGraphicWrapper: {
    height: 200,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    marginTop: 10,
    overflow: 'hidden',
  },
  quoteText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#828292',
    textAlign: 'center',
    letterSpacing: 3.5,
    lineHeight: 20,
    marginBottom: 10,
    zIndex: 2,
  },
});
