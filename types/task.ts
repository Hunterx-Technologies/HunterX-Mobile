import type { StreakMilestoneUnlock, UserReward } from './reward';

/**
 * IN_REVIEW / RESUBMIT / REJECTED: proof tasks (proof_count > 0). Submitted proof waits
 * IN_REVIEW (no XP yet); the admin approves (→ COMPLETED), asks for new photos (→ RESUBMIT)
 * or rejects it for good (→ REJECTED).
 */
export type TaskStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'SKIPPED' | 'LOCKED' | 'IN_REVIEW' | 'RESUBMIT' | 'REJECTED';
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
  /** Photos needed to complete it; 0 (or missing on older backends) = a normal task. */
  proof_count?: number;
  /** The photos sent, while IN_REVIEW / after a decision. */
  proof_urls?: string[];
  /** The admin's reason, on RESUBMIT / REJECTED. */
  review_note?: string | null;
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
  /** Scratch cards this completion unlocked — cards only, never the prize. Missing on older backends. */
  rewards_earned?: UserReward[];
  /** Set when this completion earned a streak badge. Missing on older backends. */
  streak_milestone?: StreakMilestoneUnlock | null;
  /** Set when this completion raised the level (the final level only). Missing on older backends. */
  level_up?: LevelUpInfo | null;
}

/** The level-up screen's content. Every text is shown as-is. */
export interface LevelUpInfo {
  from_level: number;
  to_level: number;
  /** Rank pill, e.g. "DORMANT". */
  rank_name: string | null;
  /** Rank line, e.g. "Dormant III". */
  title: string | null;
  level_up_label: string | null;
  level_up_title: string | null;
  level_up_message: string | null;
  is_rank_up: boolean;
  xp_earned: number;
  xp_earned_text: string;
  /** Null at the max level. */
  xp_to_next: number | null;
  next_level_title: string | null;
  /** "1,240 XP to Hollow II", or the max-level text. */
  next_level_text: string;
  button_label: string;
  /** The new dragon stage on a rank up; image_url is null until art is added. */
  dragon_stage: { stage_number: number; name: string; message: string; image_url: string | null } | null;
  /** The level-up events this screen covers; marked seen once it closes. */
  event_ids: string[];
}

export interface ReopenTaskData {
  task_id: string;
  title: string;
  task_type: TaskType;
  status: 'PENDING';
}

/** POST /tasks/:id/proof — XP comes later, on approval; only streak unlocks can come now. */
export interface SubmitProofData {
  task_id: string;
  title: string;
  status: 'IN_REVIEW';
  proof_urls: string[];
  xp_earned: 0;
  daily_streak: number;
  longest_streak: number;
  rewards_earned?: UserReward[];
  streak_milestone?: StreakMilestoneUnlock | null;
}

/** A streak life the backend spent, or a streak it broke (GET /tasks/streak/events). */
export type StreakEventType = 'LIFE_USED' | 'STREAK_BROKEN';

export interface StreakEvent {
  id: string;
  type: StreakEventType;
  /** Lives this event cost (LIFE_USED), or the lives zeroed with the streak (STREAK_BROKEN). */
  lives_lost: number;
  lives_left: number;
  /** The streak the life protected, or the one that ended. */
  streak_days: number;
  created_at: string;
}
