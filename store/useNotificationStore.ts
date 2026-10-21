import { create } from 'zustand';

import { fetchUnreadCount } from '@/services/api/notifications.service';
import { setAppBadgeCount } from '@/services/notifications/push';

/**
 * Unread inbox count, shared by the Home bell badge and the inbox screen.
 * Every change is mirrored to the app icon badge.
 */
interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  refreshUnreadCount: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  setUnreadCount: (count) => {
    const unreadCount = Math.max(0, count);
    set({ unreadCount });
    setAppBadgeCount(unreadCount);
  },
  refreshUnreadCount: async () => {
    try {
      get().setUnreadCount(await fetchUnreadCount());
    } catch {
      // Badge is best-effort — keep the last known count.
    }
  },
}));
