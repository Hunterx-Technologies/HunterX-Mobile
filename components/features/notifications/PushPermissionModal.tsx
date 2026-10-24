import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, 360);

export interface PushPermissionModalProps {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  title?: string;
  subtitle?: string;
}

export function PushPermissionModal({
  visible,
  onEnable,
  onDismiss,
  title = 'Let the System summon you',
  subtitle = 'Get immediate directive alerts before your progress or rewards expire.',
}: PushPermissionModalProps) {
  const [modalRendered, setModalRendered] = useState(visible);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setModalRendered(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 75,
          useNativeDriver: true,
        }),
      ]).start();

      // Subtle breathing pulse on the System orb
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1300,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1300,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    } else if (modalRendered) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalRendered(false);
      });
    }
  }, [visible]);

  if (!modalRendered && !visible) {
    return null;
  }

  const handleEnable = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onEnable();
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDismiss();
  };

  return (
    <Modal
      transparent
      visible={modalRendered}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        {/* Backdrop Tap to Dismiss */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropPressable} onPress={handleDismiss} />
        </Animated.View>

        {/* System Modal Card */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Subtle Orange Glow Border & Ambient Background */}
          <LinearGradient
            colors={['rgba(254, 91, 1, 0.16)', 'rgba(254, 91, 1, 0.02)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Top Edge Glowing Accent Line */}
          <LinearGradient
            colors={['transparent', '#FE5B01', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topAccentLine}
            pointerEvents="none"
          />

          {/* Close Button in Top Right */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleDismiss}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="#71717A" />
          </TouchableOpacity>

          <View style={styles.cardContent}>
            {/* System Badge */}
            <View style={styles.systemBadge}>
              <View style={styles.systemBadgeDot} />
              <Text style={styles.systemBadgeText}>SYSTEM DIRECTIVE</Text>
            </View>

            {/* Glowing Radar Summon Orb */}
            <View style={styles.orbContainer}>
              <Animated.View
                style={[
                  styles.outerOrbRing,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <View style={styles.middleOrbRing}>
                <Ionicons name="notifications" size={24} color="#FE5B01" />
              </View>
              <View style={styles.sparkleBadge}>
                <Ionicons name="sparkles" size={11} color="#FFA048" />
              </View>
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.titleText}>{title}</Text>
            <Text style={styles.subtitleText}>{subtitle}</Text>

            {/* Feature Directives Container */}
            <View style={styles.directivesBox}>
              {/* Directive 1: Streak */}
              <View style={styles.directiveRow}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(254, 91, 1, 0.12)', borderColor: 'rgba(254, 91, 1, 0.28)' }]}>
                  <Ionicons name="flame" size={17} color="#FE5B01" />
                </View>
                <View style={styles.directiveTextCol}>
                  <Text style={styles.directiveTitle}>Streak Preservation</Text>
                  <Text style={styles.directiveDesc}>Alerts before your active streak timer resets</Text>
                </View>
              </View>

              <View style={styles.directiveDivider} />

              {/* Directive 2: Rewards */}
              <View style={styles.directiveRow}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(61, 220, 151, 0.12)', borderColor: 'rgba(61, 220, 151, 0.28)' }]}>
                  <Ionicons name="gift" size={16} color="#3DDC97" />
                </View>
                <View style={styles.directiveTextCol}>
                  <Text style={styles.directiveTitle}>Reward Drops</Text>
                  <Text style={styles.directiveDesc}>Instant claim alerts when coupons & loot drop</Text>
                </View>
              </View>

              <View style={styles.directiveDivider} />

              {/* Directive 3: Quests */}
              <View style={styles.directiveRow}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(91, 140, 255, 0.12)', borderColor: 'rgba(91, 140, 255, 0.28)' }]}>
                  <Ionicons name="flash" size={16} color="#5B8CFF" />
                </View>
                <View style={styles.directiveTextCol}>
                  <Text style={styles.directiveTitle}>Quest Directives</Text>
                  <Text style={styles.directiveDesc}>Fresh daily & weekly missions dispatched</Text>
                </View>
              </View>
            </View>

            {/* Spam Reassurance */}
            <View style={styles.reassuranceRow}>
              <Ionicons name="shield-checkmark-outline" size={12} color="#71717A" />
              <Text style={styles.reassuranceText}>Never more than a few a day • Zero spam</Text>
            </View>

            {/* Action Buttons (Stacked so text never awkwardly wraps) */}
            <View style={styles.actionGroup}>
              {/* Primary Action Button */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleEnable}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#FFFFFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryGradient}
                >
                  <Ionicons name="notifications" size={17} color="#0D0F12" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Enable Notifications</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Secondary Action Button */}
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryBtnText}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdropPressable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cardContainer: {
    width: CARD_WIDTH,
    backgroundColor: '#0D1115',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(254, 91, 1, 0.28)',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  topAccentLine: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 2,
    opacity: 0.9,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  systemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254, 91, 1, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    marginBottom: 14,
  },
  systemBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FE5B01',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  systemBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: '#FE5B01',
  },
  orbContainer: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  outerOrbRing: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(254, 91, 1, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.22)',
  },
  middleOrbRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(254, 91, 1, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(254, 91, 1, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#1E1610',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.4)',
  },
  titleText: {
    fontFamily: fontFamilies.bold,
    fontSize: 18.5,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  subtitleText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    color: '#8D98A3',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  directivesBox: {
    width: '100%',
    backgroundColor: '#12161B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1C242D',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  directiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directiveTextCol: {
    flex: 1,
  },
  directiveTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: '#F4F5F6',
    marginBottom: 1,
  },
  directiveDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: '#8D98A3',
    lineHeight: 15,
  },
  directiveDivider: {
    height: 1,
    backgroundColor: '#1A2129',
    marginVertical: 8,
    marginLeft: 46,
  },
  reassuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 16,
  },
  reassuranceText: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: '#71717A',
  },
  actionGroup: {
    width: '100%',
    gap: 6,
  },
  primaryBtn: {
    width: '100%',
    height: 46,
    borderRadius: 13,
    overflow: 'hidden',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14.5,
    color: '#0D0F12',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    width: '100%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#8D98A3',
  },
});
