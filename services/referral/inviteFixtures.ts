import type { InvitedFriend, InvitedFriends, InvitedFriendsSource } from '@/services/api/referral.service';

/**
 * Fake data for the Developer menu's Invite previews (dev builds only).
 * Every third hunter has leaderboard visibility off, to show "A hunter".
 */
export type InvitePreview = 'none' | 'three' | 'thirty' | 'offline';

const NAMES = ['Kaiden', 'Asha', 'Riven', 'Meera', 'Toma', 'Zara', 'Vikram', 'Lena', 'Orin', 'Priya'];
const RANKS = ['Dormant', 'Hollow', 'Phantom', 'Predator', 'Vanguard'];

function makeFriends(count: number): InvitedFriend[] {
  return Array.from({ length: count }, (_, i): InvitedFriend =>
    i % 3 === 2
      ? { key: `preview-${i}`, visible: false }
      : {
          key: `preview-${i}`,
          visible: true,
          displayName: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ''}`,
          avatarUrl: null,
          rankName: RANKS[i % RANKS.length],
          level: 3 + ((i * 7) % 45),
        }
  );
}

const COUNTS: Record<Exclude<InvitePreview, 'offline'>, number> = { none: 0, three: 3, thirty: 30 };

export const PREVIEW_CODE = 'AX7KPQ2M';

export function previewSource(preview: InvitePreview): InvitedFriendsSource {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (preview === 'offline') {
      throw Object.assign(new Error('Network Error'), { code: 'network_error' });
    }
    const friends = makeFriends(COUNTS[preview]);
    return { count: friends.length, friends } satisfies InvitedFriends;
  };
}

/** Cached list the offline preview falls back to. */
export const PREVIEW_OFFLINE_CACHE: InvitedFriends = { count: 3, friends: makeFriends(3) };

export function isInvitePreview(value: unknown): value is InvitePreview {
  return value === 'none' || value === 'three' || value === 'thirty' || value === 'offline';
}
