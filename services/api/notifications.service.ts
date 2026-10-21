import type { ApiResponse } from '@/types/api';
import type { NotificationsPage } from '@/types/notification';

import { apiClient } from './client';

export async function fetchNotifications(cursor?: string | null, limit = 20): Promise<NotificationsPage> {
  const { data } = await apiClient.get<ApiResponse<NotificationsPage>>('/notifications', {
    params: { limit, ...(cursor ? { cursor } : {}) },
  });
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch notifications');
  }
  return data.data;
}

let inFlightUnreadCount: Promise<number> | null = null;

export async function fetchUnreadCount(): Promise<number> {
  if (inFlightUnreadCount) {
    return inFlightUnreadCount;
  }

  inFlightUnreadCount = (async () => {
    try {
      const { data } = await apiClient.get<ApiResponse<{ unread_count: number }>>('/notifications/unread-count');
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch unread count');
      }
      return data.data.unread_count;
    } finally {
      inFlightUnreadCount = null;
    }
  })();

  return inFlightUnreadCount;
}

export interface PushDevicePayload {
  token: string;
  platform: 'IOS' | 'ANDROID';
  app_version?: string;
  /** IANA zone, e.g. "Asia/Kolkata" — the backend schedules reminders in it. */
  timezone?: string;
}

export async function registerPushDevice(payload: PushDevicePayload): Promise<void> {
  const { data } = await apiClient.post<ApiResponse<{ registered: boolean }>>('/users/me/devices', payload);
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to register device');
  }
}

/** Test builds only — backend route is disabled in production. */
export async function sendTestPush(): Promise<{ devices: number; push_status: string | null; push_error: string | null }> {
  const { data } = await apiClient.post<ApiResponse<{ devices: number; push_status: string | null; push_error: string | null }>>(
    '/notifications/test',
    { title: '🔔 Diagnostics', body: 'Push notifications work on this device.' }
  );
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to send test push');
  }
  return data.data;
}

export async function unregisterPushDevice(token: string): Promise<void> {
  await apiClient.delete('/users/me/devices', { data: { token } });
}

/** Pass ids to mark specific notifications, or 'all'. Resolves to the new unread count. */
export async function markNotificationsRead(target: string[] | 'all'): Promise<number> {
  const body = target === 'all' ? { all: true } : { ids: target };
  const { data } = await apiClient.post<ApiResponse<{ unread_count: number }>>('/notifications/read', body);
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to mark notifications as read');
  }
  return data.data.unread_count;
}
