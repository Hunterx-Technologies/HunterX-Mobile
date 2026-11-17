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
  /** `maxAgeMs`: skip the call if the list was loaded more recently than this. */
  loadRequests: (options?: { maxAgeMs?: number }) => Promise<void>;
  rememberCard: (card: HunterCard) => void;
  /** After a friend action: update the cached card and the request list. */
  applyRelationship: (userId: string, relationship: FriendRelationship) => void;
  reset: () => void;
};

let inFlight: Promise<void> | null = null;
let loadedAt = 0;

function sameRequests(a: FriendRequest[], b: FriendRequest[]) {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b);
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  requests: [],
  requestsLoaded: false,
  cards: {},

  loadRequests: (options) => {
    if (inFlight) return inFlight;
    if (options?.maxAgeMs && Date.now() - loadedAt < options.maxAgeMs) return Promise.resolve();
    inFlight = fetchFriendRequests()
      .then(({ requests }) => {
        loadedAt = Date.now();
        // Checked often (Battles tab dot), so only a real change re-renders.
        if (get().requestsLoaded && sameRequests(get().requests, requests)) return;
        set({ requests, requestsLoaded: true });
      })
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
    // The Friends leaderboard changes when someone joins or leaves it; the
    // Global one hides whoever I've blocked, and shows them again on unblock.
    const wasBlocked = card?.relationship === 'blocked';
    if (relationship === 'friends' || wasFriends || relationship === 'blocked' || wasBlocked) {
      invalidateLeaderboardCache();
    }
  },

  reset: () => {
    loadedAt = 0;
    set({ requests: [], requestsLoaded: false, cards: {} });
  },
}));
