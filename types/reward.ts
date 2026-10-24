// Reward wallet + streak scratch cards. snake_case, as the backend sends it
// (see HunterX-Backend src/services/rewardService.js#toApiReward).

export type RewardRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type RewardSource = 'STREAK_MILESTONE' | 'LEVEL_UP' | 'BIRTHDAY' | 'TASK_COMPLETE' | 'ADMIN';
export type RewardStatus = 'UNSEEN' | 'SEEN' | 'SCRATCHED' | 'USED' | 'EXPIRED';
export type RewardTab = 'ACTIVE' | 'USED' | 'EXPIRED';
export type DiscountType = 'PERCENT' | 'FLAT';

/**
 * Prize fields: only present once the card is SCRATCHED / USED, and only
 * ever read from POST /rewards/:id/scratch or the wallet list — never from
 * the completion response, the unseen list or push data.
 */
export interface RewardPrize {
  discount_type: DiscountType | null;
  discount_value: number | null;
  currency?: string;
  code: string;
  reward_text?: string;
  product_name?: string;
  product_category?: string;
  product_image_url?: string;
  valid_until: string | null;
  scratched_at: string;
  used_at?: string;
}

export interface UserRewardSummary {
  id: string;
  type: 'SCRATCH_CARD';
  rarity: RewardRarity;
  source: RewardSource;
  /** Streak length, for STREAK_MILESTONE cards. */
  milestone_days: number | null;
  /** Level reached, for LEVEL_UP cards. Missing on older backends. */
  level?: number | null;
  status: RewardStatus;
  title: string | null;
  description: string | null;
  granted_at: string;
  expires_at: string | null;
}

export type UserReward = UserRewardSummary & Partial<RewardPrize>;

/** A reward whose prize has been revealed. */
export type RevealedReward = UserRewardSummary & RewardPrize;

export const hasPrize = (r: UserReward): r is RevealedReward =>
  (r.status === 'SCRATCHED' || r.status === 'USED') && typeof r.code === 'string';

export interface RewardsPage {
  items: UserReward[];
  next_cursor: string | null;
  counts?: { active: number; used: number; expired: number };
}

/** Machine-readable failure codes from the rewards endpoints. */
export type RewardErrorCode =
  | 'REWARD_EXPIRED'
  | 'REWARD_USED'
  | 'REWARD_NOT_SCRATCHED'
  | 'NO_COUPON_AVAILABLE'
  | 'REWARD_NOT_FOUND';

/** Short headline for what earned the card, e.g. "7-Day Streak Complete!". Null when unknown. */
export function rewardOccasion(r: UserRewardSummary): string | null {
  if (r.source === 'BIRTHDAY') return 'Happy Birthday, Hunter!';
  if (r.source === 'TASK_COMPLETE') return 'Special Reward Unlocked!';
  if (r.source === 'LEVEL_UP' && r.level) return `Level ${r.level} Reached!`;
  if (r.source === 'STREAK_MILESTONE' && r.milestone_days) return `${r.milestone_days}-Day Streak Complete!`;
  return null;
}

/**
 * Celebration-screen text for occasions that need their own wording. Fields
 * left out fall back to the generic scratch-card copy.
 */
export function rewardCelebrationCopy(r: UserRewardSummary): {
  title?: string;
  rewardName?: string;
  description?: string;
  buttonLabel?: string;
} {
  if (r.source === 'BIRTHDAY') {
    return {
      title: 'Here’s Your\nBirthday Gift!',
      rewardName: 'Birthday Scratch Card',
      description: 'Wishing you a legendary year ahead!\nScratch your card to claim your gift.',
      buttonLabel: 'Claim My Gift',
    };
  }
  return {};
}

/** Wallet card label for what earned the card, e.g. "7-DAY STREAK REWARD". */
export function rewardOriginLabel(r: UserRewardSummary): string {
  if (r.source === 'BIRTHDAY') return 'BIRTHDAY REWARD';
  if (r.source === 'TASK_COMPLETE') return 'SPECIAL QUEST REWARD';
  if (r.source === 'LEVEL_UP' && r.level) return `LEVEL ${r.level} REWARD`;
  if (r.milestone_days) return `${r.milestone_days}-DAY STREAK REWARD`;
  return 'HUNTERX REWARD';
}

export interface StreakMilestoneUnlock {
  days: number;
  badge_id: number;
}
