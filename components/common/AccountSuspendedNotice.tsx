import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { useAuthStore } from '@/store/useAuthStore';
import { SUPPORT_EMAIL } from '@/services/api/errors';

/**
 * "Account suspended", mounted once in the root layout. Shown the moment the
 * app learns of a ban (any request, a sign-in attempt, or the ban push);
 * the session is already gone by then, so closing it leaves the hunter on
 * Login, where signing in again brings it straight back.
 */
export function AccountSuspendedNotice() {
  const suspension = useAuthStore((s) => s.suspension);
  const clearSuspension = useAuthStore((s) => s.clearSuspension);

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
        <View style={styles.card} accessibilityRole="alert">
          <View style={styles.iconWrap}>
            <Ionicons name="ban-outline" size={26} color="#FE5B01" />
          </View>
          <Text style={styles.title}>Account suspended</Text>
          <Text style={styles.message}>
            Your HunterX account has been suspended, so you can&apos;t use the app with it.
          </Text>
          {suspension?.reason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reasonText}>{suspension.reason}</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>If you think this is a mistake, contact support.</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={contactSupport}
            accessibilityRole="button"
            accessibilityLabel="Contact support"
          >
            <Text style={styles.buttonLabel}>Contact support</Text>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    backgroundColor: '#0D1115',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#1D2530',
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(254, 91, 1, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 17.5,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  reasonBox: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(254, 91, 1, 0.08)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  reasonLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11.5,
    color: '#FE5B01',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  reasonText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  button: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FE5B01',
  },
  buttonLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  secondary: {
    width: '100%',
    height: 40,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.85,
  },
});
