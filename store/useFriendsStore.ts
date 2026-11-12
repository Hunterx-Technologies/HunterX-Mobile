import { create } from 'zustand';

import { invalidateLeaderboardCache } from '@/hooks/useLeaderboard';
import { fetchFriendRequests } from '@/services/api/friends.service';
import type { FriendRelationship, FriendRequest, HunterCard } from '@/types/friends';

/**
 * Incoming friend requests (the Friends tab strip and its count) and the
 * cards opened this session, so reopening a hunter's card is instant and
 * every place that shows them (card, request strip) agrees after a change.
 */
type FriendsState = {
  requests: FriendRequest[];
  requestsLoaded: boolean;
  cards: Record<string, HunterCard>;
  loadRequests: () => Promise<void>;
  rememberCard: (card: HunterCard) => void;
  /** After a friend action: update the cached card and the request list. */
  applyRelationship: (userId: string, relationship: FriendRelationship) => void;
  reset: () => void;
};

let inFlight: Promise<void> | null = null;

export const useFriendsStore = create<FriendsState>((set, get) => ({
  requests: [],
  requestsLoaded: false,
  cards: {},

  loadRequests: () => {
    if (inFlight) return inFlight;
    inFlight = fetchFriendRequests()
      .then(({ requests }) => set({ requests, requestsLoaded: true }))
      .catch(() => set({ requestsLoaded: true })) // keep what's shown; the strip just doesn't update
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },

  rememberCard: (card) => set((s) => ({ cards: { ...s.cards, [card.userId]: card } })),

  applyRelationship: (userId, relationship) => {
    const card = get().cards[userId];
    const wasFriends = card?.relationship === 'friends';
    set((s) => ({
      cards: card ? { ...s.cards, [userId]: { ...card, relationship } } : s.cards,
      // Any answer to their request takes it off the list.
      requests: relationship === 'incoming' ? s.requests : s.requests.filter((r) => r.userId !== userId),
    }));
    // The Friends leaderboard changes when someone joins or leaves it.
    if (relationship === 'friends' || wasFriends) invalidateLeaderboardCache();
  },

  reset: () => set({ requests: [], requestsLoaded: false, cards: {} }),
}));
