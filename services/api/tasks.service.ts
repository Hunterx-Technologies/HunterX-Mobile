import type { ApiResponse } from '@/types/api';
import type { TasksTodayData, CompleteTaskData, TaskStatus, ReopenTaskData, SubmitProofData, StreakEvent, RoutineTask } from '@/types/task';

import { apiClient } from './client';

let inFlightTasksToday: Promise<TasksTodayData> | null = null;

export async function fetchTasksToday(): Promise<TasksTodayData> {
  if (inFlightTasksToday) {
    return inFlightTasksToday;
  }

  inFlightTasksToday = (async () => {
    try {
      const { data } = await apiClient.get<ApiResponse<TasksTodayData>>('/tasks/today');
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch today\'s tasks');
      }
      return data.data;
    } finally {
      inFlightTasksToday = null;
    }
  })();

  return inFlightTasksToday;
}

export async function completeTask(
  taskId: string,
  status: TaskStatus
): Promise<CompleteTaskData> {
  const { data } = await apiClient.put<ApiResponse<CompleteTaskData>>(
    `/tasks/${taskId}/complete`,
    { status }
  );
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to update task status');
  }
  return data.data;
}

export async function reopenTask(taskId: string): Promise<ReopenTaskData> {
  const { data } = await apiClient.put<ApiResponse<ReopenTaskData>>(
    `/tasks/${taskId}/reopen`
  );
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to reopen task');
  }
  return data.data;
}

/**
 * Sends proof for a proof task: the URLs of photos already uploaded to
 * Cloudinary (uploadImageToCloudinary(uri, 'task-proof')). Exactly the
 * task's proof_count. The task goes IN_REVIEW until an admin decides.
 */
export async function submitTaskProof(taskId: string, proofUrls: string[]): Promise<SubmitProofData> {
  const { data } = await apiClient.post<ApiResponse<SubmitProofData>>(`/tasks/${taskId}/proof`, {
    proof_urls: proofUrls,
  });
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to send proof');
  }
  return data.data;
}

/** Streak lives spent / streaks broken not shown yet. Also applies a pending missed-day gap. */
export async function fetchStreakEvents(): Promise<StreakEvent[]> {
  const { data } = await apiClient.get<ApiResponse<{ events: StreakEvent[] }>>('/tasks/streak/events');
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch streak events');
  }
  return data.data.events;
}

export async function markStreakEventsSeen(ids: string[]): Promise<void> {
  const { data } = await apiClient.post<ApiResponse<{ marked: number }>>('/tasks/streak/events/seen', { ids });
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to mark streak events seen');
  }
}

/** Routine tasks the onboarding picker offers (public — no account yet). */
export async function fetchRoutineTaskOptions(): Promise<RoutineTask[]> {
  const { data } = await apiClient.get<ApiResponse<{ tasks: RoutineTask[] }>>('/public/routine-tasks');
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to load routine tasks');
  }
  return data.data.tasks;
}

/** Every routine task, each marked `selected` if it's on this hunter's daily list. */
export async function fetchMyRoutineTasks(): Promise<RoutineTask[]> {
  const { data } = await apiClient.get<ApiResponse<{ tasks: RoutineTask[] }>>('/tasks/routine');
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to load your routine');
  }
  return data.data.tasks;
}

/**
 * Replaces this hunter's routine tasks (at least one). Added tasks appear in
 * today's list straight away; removed ones leave it unless already done today.
 */
export async function saveMyRoutineTasks(taskIds: string[]): Promise<RoutineTask[]> {
  const { data } = await apiClient.put<ApiResponse<{ tasks: RoutineTask[] }>>('/tasks/routine', {
    task_ids: taskIds,
  });
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to update your routine');
  }
  return data.data.tasks;
}
