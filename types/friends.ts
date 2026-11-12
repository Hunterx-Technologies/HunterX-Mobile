/**
 * How the signed-in hunter stands with someone (friendService.js on the backend):
 *  self      it's you
 *  none      nothing yet → Add friend
 *  requested you asked them → Requested (tap to cancel)
 *  incoming  they asked you → Accept / Decline
 *  friends   friends → Remove friend
 *  blocked   you blocked them → Unblock
 */
export type FriendRelationship = 'self' | 'none' | 'requested' | 'incoming' | 'friends' | 'blocked';

/** A hunter's card (GET /friends/card/...). Never carries an email or Hunter ID. */
export type HunterCard = {
  userId: string;
  name: string;
  avatarThumbUrl: string | null;
  level: number;
  rankName: string | null;
  totalXp: number;
  streak: number;
  longestStreak: number;
  joinedAt: string | null;
  friendsSince: string | null;
  relationship: FriendRelationship;
};

/** A request waiting for me: the sender's card plus when they asked. */
export type FriendRequest = HunterCard & { requestedAt: string };

/**
 * What the card can show before its own request comes back — taken from the
 * leaderboard row the hunter tapped, so the card opens instantly.
 */
export type HunterCardPreview = Pick<HunterCard, 'userId' | 'name' | 'avatarThumbUrl' | 'level' | 'totalXp'> & {
  streak?: number | null;
  rank?: number | null;
};
