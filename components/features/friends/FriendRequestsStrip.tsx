import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { acceptFriendRequest, declineFriendRequest } from '@/services/api/friends.service';
import { getApiErrorCode } from '@/services/api/errors';
import { useFriendsStore } from '@/store/useFriendsStore';
import { showGlobalToast } from '@/store/useToastStore';
import { fontFamilies } from '@/theme/typography';
import type { FriendRequest } from '@/types/friends';

const FALLBACK_AVATAR = 'https://res.cloudinary.com/sc8zzixt/image/upload/w_96,h_96,c_fill/f_auto,q_auto/v1788468328/hunterx/app-assets/arise_avatar_11.jpg';

/**
 * Friend requests waiting for me, on the Invite Friends screen (the only
 * place they're answered). Accept / Decline right here; tapping the hunter
 * opens their card. Renders nothing when there are none.
 */
export function FriendRequestsStrip({ onOpen }: { onOpen: (request: FriendRequest) => void }) {
  const requests = useFriendsStore((s) => s.requests);
  if (requests.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        Friend requests <Text style={styles.count}>· {requests.length}</Text>
      </Text>
      {requests.map((r) => (
        <RequestRow key={r.userId} request={r} onOpen={onOpen} />
      ))}
    </View>
  );
}

function RequestRow({ request, onOpen }: { request: FriendRequest; onOpen: (r: FriendRequest) => void }) {
  const applyRelationship = useFriendsStore((s) => s.applyRelationship);
  const loadRequests = useFriendsStore((s) => s.loadRequests);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? 'accept' : 'decline');
    Haptics.selectionAsync().catch(() => {});
    try {
      const { relationship } = accept ? await acceptFriendRequest(request.userId) : await declineFriendRequest(request.userId);
      applyRelationship(request.userId, relationship);
      if (accept) showGlobalToast(`You and ${request.name} are now friends.`, 'success');
    } catch (err) {
      showGlobalToast(err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.', 'error');
      if (getApiErrorCode(err) === 'NO_PENDING_REQUEST') loadRequests();
      setBusy(null);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable style={styles.who} onPress={() => onOpen(request)} accessibilityRole="button" accessibilityLabel={`Open ${request.name}'s card`}>
        <Image source={{ uri: request.avatarThumbUrl || FALLBACK_AVATAR }} style={styles.avatar} contentFit="cover" />
        <View style={styles.whoText}>
          <Text style={styles.name} numberOfLines={1}>{request.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            Level {request.level} · {request.totalXp.toLocaleString('en-US')} XP
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => answer(false)}
        disabled={busy !== null}
        style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Decline ${request.name}`}
      >
        {busy === 'decline' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.declineText}>Decline</Text>}
      </Pressable>
      <Pressable
        onPress={() => answer(true)}
        disabled={busy !== null}
        style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Accept ${request.name}`}
      >
        {busy === 'accept' ? <ActivityIndicator size="small" color="#000000" /> : <Text style={styles.acceptText}>Accept</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    padding: 12,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.45)',
    backgroundColor: 'rgba(24, 10, 4, 0.55)',
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  count: {
    color: '#FE5B01',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  who: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.6)',
  },
  whoText: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  meta: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    color: '#8D98A3',
  },
  declineBtn: {
    height: 34,
    minWidth: 72,
    paddingHorizontal: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  acceptBtn: {
    height: 34,
    minWidth: 72,
    paddingHorizontal: 10,
    borderRadius: 17,
    backgroundColor: '#FE5B01',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#000000',
  },
  pressed: {
    opacity: 0.8,
  },
});
