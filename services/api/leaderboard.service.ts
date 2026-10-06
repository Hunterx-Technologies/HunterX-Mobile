import type { ApiResponse } from '@/types/api';
import type { LeaderboardPage, LeaderboardScope } from '@/types/leaderboard';

import { apiClient } from './client';

function extractErrorMessage(err: any): string {
  if (err?.response?.data) {
    const data = err.response.data;
    if (typeof data === 'string') return data;
    if (data.message && typeof data.message === 'string') return data.message;
    if (data.error) {
      if (typeof data.error === 'string') return data.error;
      if (data.error.message && typeof data.error.message === 'string') return data.error.message;
    }
  }
  if (err?.message && typeof err.message === 'string') return err.message;
  return 'Failed to load the leaderboard';
}

export async function fetchLeaderboardPage(
  scope: LeaderboardScope,
  cursor: string | null,
  limit: number = 20
): Promise<LeaderboardPage> {
  try {
    const { data } = await apiClient.get<ApiResponse<LeaderboardPage>>('/leaderboard', {
      params: {
        scope,
        limit,
        ...(cursor ? { cursor } : {}),
      },
    });

    if (!data.success) {
      throw new Error((data as any).error?.message || (data as any).message || 'Failed to load the leaderboard');
    }

    return data.data;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}
