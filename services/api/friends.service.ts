import type { ApiResponse } from '@/types/api';
import type { FriendRelationship, FriendRequest, HunterCard } from '@/types/friends';

import { apiClient } from './client';

// Friends between existing hunters (backend routes/friends.js). Errors keep
// the backend's error.code (getApiErrorCode) and its user-facing message.

async function unwrap<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data } = await request;
  if (!data.success) throw new Error(data.error?.message || 'Something went wrong');
  return data.data;
}

type RelationshipResult = { relationship: FriendRelationship };

const id = (userId: string) => encodeURIComponent(userId);

/** A hunter's card by user id — tapped on the leaderboard. */
export function fetchHunterCard(userId: string): Promise<HunterCard> {
  return unwrap(apiClient.get(`/friends/card/${id(userId)}`));
}

/** A hunter's card by invite code — pasted, or from an invite link. */
export function fetchHunterCardByCode(code: string): Promise<HunterCard> {
  return unwrap(apiClient.get(`/friends/card/code/${encodeURIComponent(code)}`));
}

/** Requests waiting for me, newest first. */
export function fetchFriendRequests(): Promise<{ requests: FriendRequest[]; count: number }> {
  return unwrap(apiClient.get('/friends/requests'));
}

/** Ask them. If they already asked me, this makes us friends. */
export function sendFriendRequest(userId: string): Promise<RelationshipResult> {
  return unwrap(apiClient.post(`/friends/requests/${id(userId)}`));
}

export function acceptFriendRequest(userId: string): Promise<RelationshipResult> {
  return unwrap(apiClient.post(`/friends/requests/${id(userId)}/accept`));
}

export function declineFriendRequest(userId: string): Promise<RelationshipResult> {
  return unwrap(apiClient.post(`/friends/requests/${id(userId)}/decline`));
}

export function cancelFriendRequest(userId: string): Promise<RelationshipResult> {
  return unwrap(apiClient.delete(`/friends/requests/${id(userId)}`));
}

export function removeFriend(userId: string): Promise<RelationshipResult> {
  return unwrap(apiClient.delete(`/friends/${id(userId)}`));
}

export function blockHunter(userId: string): Promise<RelationshipResult> {
  return unwrap(apiClient.post(`/friends/blocks/${id(userId)}`));
}

export function unblockHunter(userId: string): Promise<RelationshipResult> {
  return unwrap(apiClient.delete(`/friends/blocks/${id(userId)}`));
}

/** Opened someone's invite link while signed in: friends straight away. */
export function addFriendByInviteLink(code: string): Promise<RelationshipResult & { userId: string }> {
  return unwrap(apiClient.post(`/friends/link/${encodeURIComponent(code)}`));
}
