import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuthStore } from '@/store/useAuthStore';
import { cancelAccountDeletion, getCurrentUser } from '@/services/api/auth.service';
import { showGlobalToast } from '@/store/useToastStore';
import { deletionTimeLeft } from '@/utils/accountDeletion';
import { fontFamilies } from '@/theme/typography';

/**
 * "Your account will be deleted in N days" + "Keep my account", shown at the
 * top of Profile and Home while the account waits to be deleted (the
 * signed-in user's deleteAt, from /me). Renders nothing otherwise.
 */
export function DeletionPendingBanner({ style }: { style?: object }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const deleteAt = user?.deleteAt ?? null;
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  // Re-render each minute so "N hours" stays current on the last day.
  useEffect(() => {
    if (!deleteAt) return;
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [deleteAt]);

  if (!deleteAt || !user) return null;

  const keepAccount = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelAccountDeletion();
      try {
        setUser(await getCurrentUser());
      } catch {
        setUser({ ...user, deleteAt: null, daysLeft: null, deletionRequestedAt: null, delete_at: null });
      }
      showGlobalToast('Your account will not be deleted.', 'success');
    } catch (err) {
      showGlobalToast(err instanceof Error && err.message ? err.message : 'Could not cancel the deletion. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const timeLeft = deletionTimeLeft(deleteAt);

  return (
    <View
      style={[styles.banner, style]}
      accessibilityRole="alert"
      accessibilityLabel={`Your account will be deleted in ${timeLeft}.`}
    >
      <View style={styles.textRow}>
        <Ionicons name="warning" size={18} color="#F97316" />
        <Text style={styles.text}>
          Your account will be deleted in <Text style={styles.strong}>{timeLeft}</Text>.
        </Text>
      </View>
      <Pressable
        onPress={keepAccount}
        disabled={busy}
        style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Keep my account"
        accessibilityState={{ busy }}
      >
        {busy ? <ActivityIndicator size="small" color="#000000" /> : <Text style={styles.buttonText}>Keep my account</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 14,
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.45)',
    backgroundColor: 'rgba(249, 115, 22, 0.10)',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  text: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  strong: {
    fontFamily: fontFamilies.bold,
    color: '#FE5B01',
  },
  button: {
    alignSelf: 'stretch',
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.75,
  },
  buttonText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#000000',
  },
});
