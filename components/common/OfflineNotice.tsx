import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { checkConnectivity, useConnectivityStore } from '@/store/useConnectivityStore';

/**
 * App-wide "No internet connection" pop-up, mounted once in the root layout.
 * Shown while the API can't be reached (see useConnectivityStore) and closes
 * by itself as soon as it can. It blocks the screen behind it on purpose:
 * every action in HunterX needs the server.
 */
export function OfflineNotice() {
  const isOffline = useConnectivityStore((s) => s.isOffline);
  const isChecking = useConnectivityStore((s) => s.isChecking);

  // Opening the app with no internet: find out straight away, before the
  // user taps anything.
  useEffect(() => {
    checkConnectivity();
  }, []);

  return (
    <Modal
      visible={isOffline}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android back button: there's nothing to go back to while offline,
      // so it closes the app like back on any root screen. (A no-op here
      // swallowed it — the Modal gets the press, not the screen behind.)
      onRequestClose={() => BackHandler.exitApp()}
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityRole="alert">
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-offline-outline" size={26} color="#FE5B01" />
          </View>
          <Text style={styles.title}>No internet connection</Text>
          <Text style={styles.message}>Turn on mobile data or Wi-Fi to continue using HunterX.</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed, isChecking && styles.disabled]}
            onPress={() => {
              if (!isChecking) checkConnectivity();
            }}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonLabel}>Try again</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
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
    marginBottom: 20,
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
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
