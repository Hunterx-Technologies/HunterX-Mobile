import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ErrorBoundaryProps } from 'expo-router';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { reportError } from '@/services/monitoring';

/**
 * Fallback screen for expo-router's per-route error boundaries. A route file
 * re-exports it as `ErrorBoundary`; when that screen throws while rendering,
 * only that screen is replaced (tab bar and the rest of the app keep
 * working), the error is reported, and "Try again" re-renders the screen.
 *
 * Can render outside the root layout's providers (when the root layout itself
 * throws), so it uses nothing that needs them.
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, { source: 'error-boundary' });
  }, [error]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content} accessibilityRole="alert">
        <View style={styles.iconWrap}>
          <Ionicons name="warning-outline" size={26} color="#FE5B01" />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          This screen ran into a problem. We've been notified and are looking into it.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={() => {
            retry().catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(254, 91, 1, 0.12)',
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#8D98A3',
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 24,
  },
  button: {
    minWidth: 160,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FE5B01',
  },
  pressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
