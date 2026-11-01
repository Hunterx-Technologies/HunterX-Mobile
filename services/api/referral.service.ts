import type { ApiResponse } from '@/types/api';

import { apiClient } from './client';

/**
 * `reason` explains a code that can't be used. 'pending_deletion' needs the
 * backend change listed in the invite feature notes; until then a code from
 * an account waiting to be deleted comes back as a plain { valid: false }.
 */
export type ReferralLookup = {
  valid: boolean;
  inviterName?: string;
  reason?: 'pending_deletion' | 'self';
};

/**
 * GET /public/referral/:code — whether an invite code can be used, and the
 * inviter's display name. Throws on network/server errors so callers can
 * tell "invalid code" apart from "couldn't check".
 */
export async function lookupReferralCode(code: string): Promise<ReferralLookup> {
  const { data } = await apiClient.get<ApiResponse<ReferralLookup>>(
    `/public/referral/${encodeURIComponent(code)}`
  );
  if (!data.success) throw new Error('Referral lookup failed');
  return data.data;
}

/**
 * A hunter who signed up with the current user's code. Hunters with
 * leaderboard visibility off come back with `visible: false` and nothing
 * else — they're shown as "A hunter". Never carries an email or Hunter ID.
 */
export type InvitedFriend =
  | {
      key: string;
      visible: true;
      displayName: string;
      avatarUrl: string | null;
      rankName: string | null;
      level: number;
    }
  | { key: string; visible: false };

export type InvitedFriends = {
  count: number;
  friends: InvitedFriend[];
};

/** Where the Invite screen gets its friends list — swapped for fixtures in dev previews. */
export type InvitedFriendsSource = () => Promise<InvitedFriends>;

type InvitedFriendsResponse = {
  count: number;
  friends: {
    id: string | number;
    visible: boolean;
    name?: string | null;
    avatarUrl?: string | null;
    rankName?: string | null;
    level?: number | null;
  }[];
};

/**
 * GET /referrals/invited — NOT ON THE BACKEND YET (see the invite feature's
 * backend gaps). Until it ships the request 404s, and this falls back to
 * the count /me already returns, shown as that many anonymous hunters.
 */
export function fetchInvitedFriends(fallbackCount: number): InvitedFriendsSource {
  return async () => {
    try {
      const { data } = await apiClient.get<ApiResponse<InvitedFriendsResponse>>('/referrals/invited');
      if (!data.success) throw new Error('Could not load invited friends');
      return {
        count: data.data.count,
        friends: data.data.friends.map((f) =>
          f.visible
            ? {
                key: String(f.id),
                visible: true,
                displayName: f.name?.trim() || 'A hunter',
                avatarUrl: f.avatarUrl ?? null,
                rankName: f.rankName ?? null,
                level: f.level ?? 1,
              }
            : { key: String(f.id), visible: false }
        ),
      };
    } catch (err: any) {
      if ((err?.status ?? err?.response?.status) !== 404) throw err;
      return {
        count: fallbackCount,
        friends: Array.from({ length: fallbackCount }, (_, i) => ({ key: `anon-${i}`, visible: false })),
      };
    }
  };
}

/** No response at all — offline or the server unreachable, as opposed to an error reply. */
export function isNetworkError(err: unknown): boolean {
  const e = err as { code?: string; status?: number };
  return e?.code === 'network_error' && e.status == null;
}
