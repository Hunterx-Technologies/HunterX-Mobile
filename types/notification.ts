export type NotificationType =
  | 'DAILY_MOTIVATION'
  | 'STREAK_AT_RISK'
  | 'TASK_REMINDER'
  | 'STREAK_MILESTONE'
  | 'LEVEL_UP'
  | 'REWARD_READY'
  | 'STREAK_FREEZE_USED'
  | 'STREAK_BROKEN'
  | 'MONTHLY_FREEZE'
  | 'BROADCAST'
  | 'NEW_QUEST'
  | 'FRIEND_JOINED'
  | 'LEADERBOARD_UPDATE'
  | 'FEEDBACK_UPDATE'
  | 'HEALTH_SYNC'
  | 'WIN_BACK';

export interface AppNotification {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  image_url: string | null;
  /** expo-router path to open on tap. */
  url: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsPage {
  notifications: AppNotification[];
  next_cursor: string | null;
  unread_count: number;
}
