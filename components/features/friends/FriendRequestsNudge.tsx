import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useFriendsStore } from '@/store/useFriendsStore';
import { fontFamilies } from '@/theme/typography';

/**
 * A small heads-up on the Friends tab when friend requests are waiting.
 * Requests are answered on the Invite Friends screen; this just points
 * there. Renders nothing when there are none.
 */
export function FriendRequestsNudge() {
  const count = useFriendsStore((s) => s.requests.length);
  if (count === 0) return null;
  const label = `You have ${count} friend request${count === 1 ? '' : 's'}`;
  return (
    <Pressable
      onPress={() => router.push('/invite-friends')}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open Invite Friends to answer.`}
    >
      <View style={styles.dot} />
      <Ionicons name="person-add" size={14} color="#FE5B01" />
      <Text style={styles.text} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color="#8D98A3" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.45)',
    backgroundColor: 'rgba(254, 91, 1, 0.1)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FE5B01',
  },
  text: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.8,
  },
});
