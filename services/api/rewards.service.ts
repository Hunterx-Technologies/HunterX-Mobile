import type { ApiResponse } from '@/types/api';
import type { RevealedReward, RewardTab, RewardsPage, UserReward } from '@/types/reward';

import { ApiError, apiClient } from './client';
import { isRewardsMockEnabled, rewardsMock } from './rewards.mock';

// The prize on a scratch card is picked by the backend; the app only ever
// reveals what POST /rewards/:id/scratch returns. In dev builds the calls
// can be routed to rewards.mock.ts (see isRewardsMockEnabled).

function unwrap<T>(data: ApiResponse<T>, fallback: string): T {
  if (!data.success) {
    throw new ApiError(data.error?.code || 'api_error', data.error?.message || fallback);
  }
  return data.data;
}

export async function fetchUnseenRewards(): Promise<UserReward[]> {
  if (isRewardsMockEnabled()) return rewardsMock.fetchUnseenRewards();
  const { data } = await apiClient.get<ApiResponse<{ rewards: UserReward[] }>>('/rewards/unseen');
  return unwrap(data, 'Failed to fetch new rewards').rewards;
}

/** Idempotent. */
export async function markRewardSeen(id: string): Promise<void> {
  if (isRewardsMockEnabled()) return rewardsMock.markRewardSeen(id);
  const { data } = await apiClient.post<ApiResponse<UserReward>>(`/rewards/${id}/seen`);
  unwrap(data, 'Failed to update reward');
}

export async function fetchRewards(tab: RewardTab, cursor?: string | null): Promise<RewardsPage> {
  if (isRewardsMockEnabled()) return rewardsMock.fetchRewards(tab, cursor);
  const { data } = await apiClient.get<ApiResponse<RewardsPage>>('/rewards', {
    params: { tab, ...(cursor ? { cursor } : {}) },
  });
  return unwrap(data, 'Failed to fetch rewards');
}

/**
 * Reveals the card's prize. Idempotent: the same prize comes back on every
 * call. Throws ApiError with code REWARD_EXPIRED / REWARD_USED (409),
 * NO_COUPON_AVAILABLE (422) or REWARD_NOT_FOUND (404).
 */
export async function scratchReward(id: string): Promise<RevealedReward> {
  if (isRewardsMockEnabled()) return rewardsMock.scratchReward(id);
  const { data } = await apiClient.post<ApiResponse<RevealedReward>>(`/rewards/${id}/scratch`);
  return unwrap(data, 'Failed to reveal reward');
}

export async function markRewardUsed(id: string): Promise<UserReward> {
  if (isRewardsMockEnabled()) return rewardsMock.markRewardUsed(id);
  const { data } = await apiClient.post<ApiResponse<UserReward>>(`/rewards/${id}/use`);
  return unwrap(data, 'Failed to mark reward as used');
}
