import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { fontFamilies } from '@/theme/typography';
import { useAuthStore } from '@/store/useAuthStore';
import { SUPPORT_EMAIL } from '@/services/api/errors';

const ORANGE = '#FE5B01';
const RED = '#FF4A3D';
const ICON_HALO = 120;
const ICON_RING = 80;

/**
 * "Account suspended", mounted once in the root layout. Shown the moment the
 * app learns of a ban (any request, a sign-in attempt, or the ban push);
 * the session is already gone by then, so closing it leaves the hunter on
 * Login, where signing in again brings it straight back.
 */
export function AccountSuspendedNotice() {
  const suspension = useAuthStore((s) => s.suspension);
  const clearSuspension = useAuthStore((s) => s.clearSuspension);
  const reason = suspension?.reason?.trim();

  const contactSupport = () => {
    const subject = encodeURIComponent('HunterX account suspended');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {});
  };

  return (
    <Modal
      visible={suspension !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={clearSuspension}
    >
      <View style={styles.overlay}>
        <View style={styles.cardGlow}>
          <View style={styles.card} accessibilityRole="alert">
            {/* Soft warm light from the left edge and bottom-right corner.
                The Svg needs explicit 100% size, or it renders 300×150 and
                the glow ends in a hard-edged block. */}
            <Svg
              style={StyleSheet.absoluteFill}
              width="100%"
              height="100%"
              pointerEvents="none"
            >
              <Defs>
                <RadialGradient id="glowLeft" cx="0%" cy="30%" r="60%">
                  <Stop offset="0" stopColor={ORANGE} stopOpacity={0.2} />
                  <Stop offset="1" stopColor={ORANGE} stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id="glowCorner" cx="100%" cy="100%" r="55%">
                  <Stop offset="0" stopColor={ORANGE} stopOpacity={0.32} />
                  <Stop offset="1" stopColor={ORANGE} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#glowLeft)" />
              <Rect width="100%" height="100%" fill="url(#glowCorner)" />
            </Svg>

            <Pressable
              style={({ pressed }) => [styles.closeIcon, pressed && styles.pressed]}
              onPress={clearSuspension}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={26} color="#D4D4D8" />
            </Pressable>

            {/* Ban badge: dark disc, coral ring, red halo (drawn in Svg so it
                looks the same on Android, which has no coloured shadows). */}
            <View style={styles.iconWrap}>
              <Svg width={ICON_HALO} height={ICON_HALO} style={StyleSheet.absoluteFill}>
                <Defs>
                  <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                    <Stop offset="0.55" stopColor={RED} stopOpacity={0.45} />
                    <Stop offset="1" stopColor={RED} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={ICON_HALO / 2} cy={ICON_HALO / 2} r={ICON_HALO / 2} fill="url(#halo)" />
              </Svg>
              <View style={styles.iconRing}>
                <Ionicons name="ban-outline" size={46} color={RED} />
              </View>
            </View>

            <Text style={styles.title}>Account Suspended</Text>
            <Text style={styles.message}>
              Your HunterX account has been suspended, so you can&apos;t use the app with it.
            </Text>

            {!!reason && (
              <Text style={styles.reasonText}>
                <Text style={styles.reasonLabel}>Reason: </Text>
                {reason}
              </Text>
            )}

            <Text style={styles.hint}>If you think this is a mistake, contact support.</Text>

            <Pressable
              style={({ pressed }) => [styles.buttonShadow, pressed && styles.pressed]}
              onPress={contactSupport}
              accessibilityRole="button"
              accessibilityLabel="Contact support"
            >
              <LinearGradient
                colors={['#FF9A1F', '#FF5A00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                <Ionicons name="headset-outline" size={20} color="#FFFFFF" />
                <Text style={styles.buttonLabel}>Contact Support</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              onPress={clearSuspension}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.secondaryLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // Outer orange glow; kept off the card because overflow: hidden clips shadows on iOS.
  cardGlow: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: '#0A0A0C',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#0A0A0C',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: ORANGE,
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  closeIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconWrap: {
    width: ICON_HALO,
    height: ICON_HALO,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconRing: {
    width: ICON_RING,
    height: ICON_RING,
    borderRadius: ICON_RING / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 140, 110, 0.8)',
    backgroundColor: '#140707',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 26,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: '#B4B4BB',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
  },
  reasonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 21,
    textAlign: 'center',
    marginTop: -6,
    marginBottom: 18,
  },
  reasonLabel: {
    color: ORANGE,
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: '#B4B4BB',
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonShadow: {
    width: '100%',
    borderRadius: 26,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  button: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondary: {
    width: '100%',
    height: 42,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#D4D4D8',
  },
  pressed: {
    opacity: 0.85,
  },
});
