import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { deletionTimeLeft } from '@/utils/accountDeletion';
import { fontFamilies } from '@/theme/typography';

/**
 * One-line red notice on Home while the account waits to be deleted. Taps
 * through to Profile, where DeletionPendingBanner has "Keep my account".
 * Renders nothing otherwise.
 */
export function DeletionPendingNotice({ style }: { style?: object }) {
  const deleteAt = useAuthStore((s) => s.user?.deleteAt ?? null);
  if (!deleteAt) return null;

  const timeLeft = deletionTimeLeft(deleteAt);
  return (
    <Pressable
      onPress={() => router.navigate('/(tabs)/profile')}
      style={({ pressed }) => [styles.notice, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={`Your account will be deleted in ${timeLeft}. Open Profile to keep it.`}
    >
      <Ionicons name="warning" size={16} color="#EF4444" />
      <Text style={styles.text} numberOfLines={2}>
        Account deletion in <Text style={styles.strong}>{timeLeft}</Text>. Quests are paused. Open Profile to keep it.
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#EF4444" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(38, 12, 12, 0.95)',
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    color: '#E5E5E5',
    fontSize: 13,
    fontFamily: fontFamilies.medium,
  },
  strong: {
    color: '#EF4444',
    fontFamily: fontFamilies.bold,
  },
});
