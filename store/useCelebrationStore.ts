import { create } from 'zustand';
import type { LevelUpOptions } from '@/store/useLevelUpStore';
import type { StreakBadgeOptions } from '@/store/useStreakBadgeStore';
import type { StreakBreakOptions } from '@/store/useStreakBreakStore';
import type { UserReward } from '@/types/reward';

// One full-screen celebration at a time. showStreakBreak(), showLevelUp(),
// showStreakBadge() and showReward() all queue here; each is shown once the
// one before it has closed. Items queued in the same tick (one batch, e.g. a
// single quest completion) play in a fixed order: streak life lost →
// level-up → streak badge → reward.
//
// The screens themselves are the Global* components in the root layout.
// Each registers a presenter for its kind on mount, so a queued item waits
// until its screen exists (e.g. on a cold start).

export interface RewardCelebrationOptions {
  /** A card summary — never read prize fields from it. */
  reward: UserReward;
}

interface CelebrationOptions {
  streakBreak: StreakBreakOptions;
  levelUp: LevelUpOptions;
  streakBadge: StreakBadgeOptions;
  reward: RewardCelebrationOptions;
}

export type CelebrationKind = keyof CelebrationOptions;

export type Celebration = {
  [K in CelebrationKind]: { kind: K; options: CelebrationOptions[K] };
}[CelebrationKind];

/** Shows one celebration; must call `done` once it has closed. */
export type CelebrationPresenter<K extends CelebrationKind> = (options: CelebrationOptions[K], done: () => void) => void;

const ORDER: Record<CelebrationKind, number> = { streakBreak: 0, levelUp: 1, streakBadge: 2, reward: 3 };

// Lets a closing modal finish animating before the next one opens (iOS
// can't present a modal while another is still dismissing).
const GAP_MS = 450;

interface CelebrationState {
  queue: Celebration[];
  current: Celebration | null;
}

export const useCelebrationStore = create<CelebrationState>(() => ({
  queue: [],
  current: null,
}));

const presenters: { [K in CelebrationKind]?: CelebrationPresenter<K> } = {};
/** Screens that mustn't be covered right now (e.g. Home's "Quest Cleared" sheet). */
const holds = new Set<string>();
let batch: Celebration[] = [];
let batchScheduled = false;
/** Rewards queued this session — the same card is never celebrated twice. */
const queuedRewardIds = new Set<string>();

function present(item: Celebration, done: () => void): boolean {
  switch (item.kind) {
    case 'streakBreak': {
      const presenter = presenters.streakBreak;
      if (!presenter) return false;
      presenter(item.options, done);
      return true;
    }
    case 'levelUp': {
      const presenter = presenters.levelUp;
      if (!presenter) return false;
      presenter(item.options, done);
      return true;
    }
    case 'streakBadge': {
      const presenter = presenters.streakBadge;
      if (!presenter) return false;
      presenter(item.options, done);
      return true;
    }
    case 'reward': {
      const presenter = presenters.reward;
      if (!presenter) return false;
      presenter(item.options, done);
      return true;
    }
  }
}

function advance() {
  const { current, queue } = useCelebrationStore.getState();
  if (current || queue.length === 0 || holds.size > 0) return;

  const [next, ...rest] = queue;
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    useCelebrationStore.setState({ current: null });
    setTimeout(advance, GAP_MS);
  };

  useCelebrationStore.setState({ current: next, queue: rest });
  // Its screen isn't mounted yet: put it back and wait for registration.
  if (!present(next, done)) {
    useCelebrationStore.setState({ current: null, queue: [next, ...rest] });
  }
}

// Everything still waiting is kept in ORDER (oldest first within a kind),
// not just this batch: on app open, items arrive from separate requests,
// and a level-up must still come before a reward card queued a moment earlier.
function flushBatch() {
  batchScheduled = false;
  const waiting = [...useCelebrationStore.getState().queue, ...batch];
  batch = [];
  const sorted = waiting.map((item, i) => ({ item, i })).sort((a, b) => ORDER[a.item.kind] - ORDER[b.item.kind] || a.i - b.i);
  useCelebrationStore.setState({ queue: sorted.map(({ item }) => item) });
  advance();
}

/**
 * Pauses the queue while a screen that isn't part of it is up (the next
 * celebration would open on top of it), and resumes once released.
 */
export function setCelebrationHold(key: string, held: boolean) {
  if (held) {
    holds.add(key);
    return;
  }
  if (holds.delete(key)) setTimeout(advance, GAP_MS);
}

export function enqueueCelebration(item: Celebration) {
  if (item.kind === 'reward') {
    if (queuedRewardIds.has(item.options.reward.id)) return;
    queuedRewardIds.add(item.options.reward.id);
  }
  batch.push(item);
  if (!batchScheduled) {
    batchScheduled = true;
    setTimeout(flushBatch, 0);
  }
}

/** Called by each Global* screen on mount. Returns the unregister function. */
export function registerCelebrationPresenter<K extends CelebrationKind>(kind: K, presenter: CelebrationPresenter<K>) {
  (presenters as Record<K, CelebrationPresenter<K> | undefined>)[kind] = presenter;
  advance();
  return () => {
    if (presenters[kind] === presenter) delete presenters[kind];
  };
}

/** Queues the "You've earned a scratch card" screen for a reward card. Ignores cards already queued this session. */
export const showReward = (reward: UserReward) => {
  enqueueCelebration({ kind: 'reward', options: { reward } });
};
