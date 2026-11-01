import AsyncStorage from '@react-native-async-storage/async-storage';

import type { InvitedFriends } from '@/services/api/referral.service';

/**
 * The signed-in hunter's own invite code and last friends list, so the
 * Invite screen still copies, shares and shows something when offline.
 * Per user — never shows one account's code to another on a shared phone.
 * Not secret (the code is meant to be shared), so AsyncStorage is enough.
 */
type CachedInvite = { code: string | null; friends: InvitedFriends | null };

const key = (userId: string) => `hunterx.invite.${userId}`;

export async function readInviteCache(userId: string): Promise<CachedInvite | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as CachedInvite) : null;
  } catch {
    return null;
  }
}

export async function writeInviteCache(userId: string, patch: Partial<CachedInvite>): Promise<void> {
  try {
    const current = (await readInviteCache(userId)) ?? { code: null, friends: null };
    await AsyncStorage.setItem(key(userId), JSON.stringify({ ...current, ...patch }));
  } catch {}
}
