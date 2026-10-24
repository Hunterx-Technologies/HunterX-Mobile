import type {
  DiscountType,
  RevealedReward,
  RewardRarity,
  RewardTab,
  RewardsPage,
  UserReward,
} from '@/types/reward';

import { ApiError } from './client';

// Dev-only stand-in for the rewards endpoints, so the celebration, scratch
// and wallet flows can be exercised without a backend. It mirrors the
// backend's rules: a prize is drawn by weight ONCE per reward id and kept,
// so scratching again returns the same prize. This is the only place in the
// app that ever picks a prize, and it never runs in a release build.
//
// Turn it on by default with REWARDS_USE_MOCK, or at runtime from the
// Developer section (Profile → Scratch Flow Test).

/** Route rewards calls to this mock in dev builds by default. */
export const REWARDS_USE_MOCK = false;

export type RewardsMockMode = 'normal' | 'slow' | 'error' | 'noCoupon';

let enabledOverride: boolean | null = null;
let mode: RewardsMockMode = 'normal';

export const isRewardsMockEnabled = () => __DEV__ && (enabledOverride ?? REWARDS_USE_MOCK);
export const setRewardsMockEnabled = (enabled: boolean) => {
  enabledOverride = enabled;
};
export const getRewardsMockMode = () => mode;
/** slow: 2.5s scratch; error: scratch fails like a dropped connection; noCoupon: scratch answers 422. */
export const setRewardsMockMode = (next: RewardsMockMode) => {
  mode = next;
};

interface MockCoupon {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  currency?: string;
  product_name: string;
  weight: number;
}

// Same shape as an admin's milestone config: 10% / 40% / 70% at 50 / 30 / 20.
const MOCK_COUPONS: MockCoupon[] = [
  { code: 'HUNTER10', discount_type: 'PERCENT', discount_value: 10, product_name: 'HunterX Partner Store', weight: 50 },
  { code: 'HUNTER40', discount_type: 'PERCENT', discount_value: 40, product_name: 'HunterX Partner Store', weight: 30 },
  { code: 'HUNTER70', discount_type: 'PERCENT', discount_value: 70, product_name: 'HunterX Partner Store', weight: 20 },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function pickCoupon(): MockCoupon {
  const total = MOCK_COUPONS.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const coupon of MOCK_COUPONS) {
    roll -= coupon.weight;
    if (roll < 0) return coupon;
  }
  return MOCK_COUPONS[0];
}

function prizeFields(coupon: MockCoupon) {
  return {
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    currency: coupon.currency,
    code: coupon.code,
    reward_text: `${coupon.discount_value}% OFF`,
    product_name: coupon.product_name,
    valid_until: iso(30 * DAY_MS),
    scratched_at: new Date().toISOString(),
  };
}

let nextId = 9000;

function card(days: number, rarity: RewardRarity, extra: Partial<UserReward> = {}): UserReward {
  nextId += 1;
  return {
    id: String(nextId),
    type: 'SCRATCH_CARD',
    rarity,
    source: 'STREAK_MILESTONE',
    milestone_days: days,
    level: null,
    status: 'UNSEEN',
    title: null,
    description: null,
    granted_at: iso(-DAY_MS),
    expires_at: null,
    ...extra,
  };
}

const rewards: UserReward[] = [
  card(7, 'rare'),
  card(14, 'epic', { status: 'SEEN' }),
  card(7, 'rare', { status: 'SCRATCHED', ...prizeFields(MOCK_COUPONS[1]) }),
  card(30, 'legendary', { status: 'USED', ...prizeFields(MOCK_COUPONS[0]), used_at: iso(-DAY_MS / 2) }),
  card(7, 'rare', { status: 'EXPIRED', expires_at: iso(-2 * DAY_MS) }),
  card(0, 'rare', { source: 'LEVEL_UP', milestone_days: null, level: 10, status: 'SEEN' }),
  card(0, 'epic', { source: 'BIRTHDAY', milestone_days: null }),
];

const find = (id: string) => {
  const reward = rewards.find((r) => r.id === id);
  if (!reward) throw new ApiError('REWARD_NOT_FOUND', 'Reward not found', 404);
  return reward;
};

const inTab = (r: UserReward, tab: RewardTab) =>
  tab === 'USED' ? r.status === 'USED' : tab === 'EXPIRED' ? r.status === 'EXPIRED' : r.status !== 'USED' && r.status !== 'EXPIRED';

// Summaries never carry prize fields, same as the backend.
function summary(r: UserReward): UserReward {
  if (r.status === 'SCRATCHED' || r.status === 'USED') return { ...r };
  const { id, type, rarity, source, milestone_days, level, status, title, description, granted_at, expires_at } = r;
  return { id, type, rarity, source, milestone_days, level, status, title, description, granted_at, expires_at };
}

export const rewardsMock = {
  async fetchUnseenRewards(): Promise<UserReward[]> {
    await wait(300);
    return rewards.filter((r) => r.status === 'UNSEEN').map(summary);
  },

  async markRewardSeen(id: string): Promise<void> {
    await wait(150);
    const reward = find(id);
    if (reward.status === 'UNSEEN') reward.status = 'SEEN';
  },

  async fetchRewards(tab: RewardTab, cursor?: string | null): Promise<RewardsPage> {
    await wait(mode === 'slow' ? 1500 : 400);
    // Everything fits on the first page.
    if (cursor) return { items: [], next_cursor: null };
    return {
      items: rewards.filter((r) => inTab(r, tab)).map(summary).reverse(),
      next_cursor: null,
      counts: {
        active: rewards.filter((r) => inTab(r, 'ACTIVE')).length,
        used: rewards.filter((r) => inTab(r, 'USED')).length,
        expired: rewards.filter((r) => inTab(r, 'EXPIRED')).length,
      },
    };
  },

  async scratchReward(id: string): Promise<RevealedReward> {
    await wait(mode === 'slow' ? 2500 : 500);
    if (mode === 'error') throw new ApiError('network_error', 'Network Error');
    const reward = find(id);
    if (reward.status === 'USED') throw new ApiError('REWARD_USED', 'This reward has already been used', 409);
    if (reward.status === 'EXPIRED') throw new ApiError('REWARD_EXPIRED', 'This reward has expired', 409);
    if (reward.status !== 'SCRATCHED') {
      if (mode === 'noCoupon') throw new ApiError('NO_COUPON_AVAILABLE', 'Rewards are being restocked. Try again later.', 422);
      Object.assign(reward, prizeFields(pickCoupon()), { status: 'SCRATCHED' });
    }
    return { ...reward } as RevealedReward;
  },

  async markRewardUsed(id: string): Promise<UserReward> {
    await wait(mode === 'slow' ? 1500 : 400);
    const reward = find(id);
    if (reward.status === 'EXPIRED') throw new ApiError('REWARD_EXPIRED', 'This reward has expired', 409);
    if (reward.status !== 'SCRATCHED' && reward.status !== 'USED') {
      throw new ApiError('REWARD_NOT_SCRATCHED', 'Scratch this card before using it', 409);
    }
    reward.status = 'USED';
    reward.used_at = new Date().toISOString();
    return { ...reward };
  },

  /** Adds a fresh unscratched card, e.g. for the Developer section's Reward Test. */
  grant(days = 7): UserReward {
    const reward = card(days, days >= 30 ? 'legendary' : days >= 14 ? 'epic' : 'rare', { granted_at: new Date().toISOString() });
    rewards.push(reward);
    return summary(reward);
  },
};
