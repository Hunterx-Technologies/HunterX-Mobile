import type { ApiResponse } from '@/types/api';
import type { LevelUpInfo } from '@/types/task';
import { apiClient } from './client';

export interface UserActivitySummary {
  member_since?: string;
  current_streak?: number;
  best_record?: number;
  total_quests_cleared?: number;
}

export interface UserActivityLog {
  id: string | number;
  task_id?: string | number;
  title: string;
  /** Older backends send no status — those logs were all completed. */
  status?: 'completed' | 'partial' | 'skipped';
  xp_earned: number;
  schedule_date?: string | null;
  completed_at?: string;
  day_number?: number;
  date_label?: string;
}

export interface UserActivityPagination {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  has_next_page: boolean;
}

export interface UserActivityData {
  summary: UserActivitySummary;
  logs: UserActivityLog[];
  pagination: UserActivityPagination;
}

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
  return 'An unexpected error occurred';
}

export async function fetchUserActivity(page = 1, limit = 10): Promise<UserActivityData> {
  try {
    const { data } = await apiClient.get<ApiResponse<UserActivityData>>('/users/activity', {
      params: { page, limit },
    });
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      throw new Error((data as any).error?.message || 'Failed to fetch activity');
    }
    const result = (data as any)?.data || data;
    return result;
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/**
 * "My Data" status (GET/POST /users/me/data-export).
 * email: the address the export goes to, masked ("sh•••••@gmail.com").
 * nextAvailableAt: null when another export can be requested now.
 */
export interface DataExportStatus {
  email: string | null;
  lastRequestedAt: string | null;
  nextAvailableAt: string | null;
}

/** When the last export was requested, and when another is allowed. */
export async function getDataExportStatus(): Promise<DataExportStatus> {
  try {
    const { data } = await apiClient.get<ApiResponse<DataExportStatus>>('/users/me/data-export');
    return (data as any)?.data ?? { email: null, lastRequestedAt: null, nextAvailableAt: null };
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/** Emails the user their data as an Excel attachment. Once per 24h. */
export async function exportUserData(): Promise<{ message: string; status: DataExportStatus | null }> {
  try {
    const { data } = await apiClient.post<ApiResponse<DataExportStatus>>('/users/me/data-export');
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      throw new Error((data as any).error?.message || (data as any).message || 'Failed to request data export');
    }
    return {
      message: (data as any)?.message || 'We emailed you your data.',
      status: (data as any)?.data ?? null,
    };
  } catch (err: any) {
    throw new Error(extractErrorMessage(err));
  }
}

/** Level-ups not shown yet (an approved proof, a screen cut short), as one screen. */
export async function fetchPendingLevelUp(): Promise<LevelUpInfo | null> {
  const { data } = await apiClient.get<ApiResponse<{ level_up: LevelUpInfo | null }>>('/users/me/level-up');
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch level-up');
  }
  return data.data.level_up;
}

export async function markLevelUpsSeen(ids: string[]): Promise<void> {
  const { data } = await apiClient.post<ApiResponse<{ marked: number }>>('/users/me/level-up/seen', { ids });
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to mark level-up seen');
  }
}

/** A streak badge earned but not shown yet (GET /users/me/streak-badges/unseen). */
export interface UnseenStreakBadge {
  id: string;
  badge_id: string;
  name: string;
  description: string | null;
  /** The milestone, e.g. 30 — matches STREAK_BADGES_DATA's dayNumber. */
  streak_days: number;
  earned_at: string | null;
}

export async function fetchUnseenStreakBadges(): Promise<UnseenStreakBadge[]> {
  const { data } = await apiClient.get<ApiResponse<{ badges: UnseenStreakBadge[] }>>('/users/me/streak-badges/unseen');
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch streak badges');
  }
  return data.data.badges;
}

export async function markStreakBadgesSeen(ids: string[]): Promise<void> {
  const { data } = await apiClient.post<ApiResponse<{ marked: number }>>('/users/me/streak-badges/seen', { ids });
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to mark streak badges seen');
  }
}
