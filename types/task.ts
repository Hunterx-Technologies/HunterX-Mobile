export type TaskStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'SKIPPED' | 'LOCKED';
export type TaskType = 'DAILY_FIXED' | 'DAILY_ADMIN' | 'WEEKLY' | 'MONTHLY';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  tag: string;
  image_url: string | null;
  image_url_male?: string | null;
  image_url_female?: string | null;
  task_type: TaskType;
  xp_reward: number;
  xp_partial: number;
  allows_partial: boolean;
  target_value: number | null;
  target_unit: string | null;
  is_recurring: boolean;
  start_date?: string;
  end_date?: string;
  is_paid?: boolean;
  status: TaskStatus;
  progress_value: number | null;
  xp_earned: number;
  completed_at: string | null;
  period_start?: string; // For MONTHLY tasks
  price?: number; // For locked tasks
  currency?: string; // e.g. "INR"
}

export interface LockedTaskItem extends TaskItem {
  status: 'LOCKED';
  price: number;
  currency: string;
}

export interface TasksTodayData {
  date: string;
  week_start: string;
  daily: TaskItem[];
  weekly: TaskItem[];
  monthly: (TaskItem & { period_start?: string })[];
  locked: LockedTaskItem[];
  daily_xp_earned: number;
  daily_xp_possible: number;
  weekly_xp_earned: number;
  weekly_xp_possible: number;
  monthly_xp_earned?: number;
  monthly_xp_possible?: number;
  streak?: {
    at_risk: boolean;
    [key: string]: any;
  };
}

export interface CompleteTaskData {
  task_id: string;
  title: string;
  task_type: TaskType;
  status: TaskStatus;
  progress_value: number | null;
  target_value: number | null;
  target_unit: string | null;
  xp_reward: number;
  xp_partial: number;
  xp_earned: number;
  completed_at: string | null;
  total_xp: number;
  daily_streak: number;
  longest_streak: number;
}

export interface ReopenTaskData {
  task_id: string;
  title: string;
  task_type: TaskType;
  status: 'PENDING';
}
