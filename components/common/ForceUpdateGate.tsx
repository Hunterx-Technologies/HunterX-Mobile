import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { isStoreUpdateAvailable, startStoreUpdate } from '@/services/appUpdate/storeUpdate';

// Least time between store checks when the app comes back to the foreground.
const RECHECK_MS = 5 * 60 * 1000;

/**
 * App-wide "Update required" screen, mounted once in the root layout. When
 * Play Store / App Store has a newer HunterX, the app can't be used until it's
 * updated: no close button, and back closes the app.
 *
 * Android opens Play's own full-screen update page straight away; if the user
 * backs out of it, this screen is waiting underneath.
 */
export function ForceUpdateGate() {
  const [required, setRequired] = useState(false);
  const [starting, setStarting] = useState(false);
  const lastCheckRef = useRef(0);
  const autoStartedRef = useRef(false);

  const start = async () => {
    setStarting(true);
    try {
      await startStoreUpdate();
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      lastCheckRef.current = Date.now();
      const available = await isStoreUpdateAvailable();
      if (cancelled || !available) return;
      setRequired(true);
      // Once per launch: Play's full-screen page is the smoothest way through.
      // iOS waits for the tap, since leaving for the App Store unasked is jarring.
      if (Platform.OS === 'android' && !autoStartedRef.current) {
        autoStartedRef.current = true;
        start();
      }
    };

    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastCheckRef.current > RECHECK_MS) check();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return (
    <Modal
      visible={required}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Back: nothing to go back to, so close the app (same as OfflineNotice).
      onRequestClose={() => BackHandler.exitApp()}
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityRole="alert">
          <View style={styles.iconWrap}>
            <Ionicons name="arrow-up-circle-outline" size={28} color="#FE5B01" />
          </View>
          <Text style={styles.title}>Update required</Text>
          <Text style={styles.message}>
            A new version of HunterX is available. Update the app to keep hunting.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed, starting && styles.disabled]}
            onPress={() => {
              if (!starting) start();
            }}
            accessibilityRole="button"
            accessibilityLabel="Update now"
          >
            {starting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonLabel}>Update now</Text>
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
    backgroundColor: 'rgba(0,0,0,0.92)',
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
