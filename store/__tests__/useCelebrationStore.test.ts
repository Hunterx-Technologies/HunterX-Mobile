import {
  enqueueCelebration,
  registerCelebrationPresenter,
  resetCelebrations,
  setCelebrationHold,
  showReward,
  useCelebrationStore,
  whenCelebrationsIdle,
} from '@/store/useCelebrationStore';
import type { UserReward } from '@/types/reward';

// The 7-day streak flow: badge → reward → level-up, one at a time.

type Shown = { kind: string; done: () => void };
let shown: Shown[] = [];
const unregister: (() => void)[] = [];

const reward = (id: string) => ({ id } as unknown as UserReward);
const levelUp = () => ({ kind: 'levelUp', options: { level: 2 } }) as Parameters<typeof enqueueCelebration>[0];
const badge = () => ({ kind: 'streakBadge', options: { currentIndex: 0 } }) as Parameters<typeof enqueueCelebration>[0];

/** Closes the screen showing now and lets the gap between screens pass. */
const closeCurrent = () => {
  shown[shown.length - 1].done();
  jest.advanceTimersByTime(500);
};

beforeEach(() => {
  jest.useFakeTimers();
  resetCelebrations();
  shown = [];
  for (const kind of ['streakBadge', 'reward', 'levelUp'] as const) {
    unregister.push(registerCelebrationPresenter(kind, (_options: unknown, done: () => void) => shown.push({ kind, done })));
  }
});

afterEach(() => {
  unregister.splice(0).forEach((u) => u());
  jest.useRealTimers();
});

it('plays a batch as badge → reward → level-up, one at a time', () => {
  enqueueCelebration(levelUp());
  showReward(reward('r1'));
  enqueueCelebration(badge());
  jest.advanceTimersByTime(0);

  expect(shown.map((s) => s.kind)).toEqual(['streakBadge']);
  closeCurrent();
  expect(shown.map((s) => s.kind)).toEqual(['streakBadge', 'reward']);
  closeCurrent();
  expect(shown.map((s) => s.kind)).toEqual(['streakBadge', 'reward', 'levelUp']);
  closeCurrent();
  expect(useCelebrationStore.getState()).toMatchObject({ current: null, queue: [] });
});

it('never opens the next screen until the current one has closed', () => {
  enqueueCelebration(badge());
  showReward(reward('r1'));
  jest.advanceTimersByTime(10_000);
  expect(shown).toHaveLength(1);
});

it('ignores a second "closed" from the same screen (double tap)', () => {
  enqueueCelebration(badge());
  showReward(reward('r1'));
  enqueueCelebration(levelUp());
  jest.advanceTimersByTime(0);

  const first = shown[0];
  first.done();
  first.done();
  jest.advanceTimersByTime(500);
  first.done();
  jest.advanceTimersByTime(500);
  // Only the reward has opened; the level-up still waits for it.
  expect(shown.map((s) => s.kind)).toEqual(['streakBadge', 'reward']);
});

it('shows the same reward card once, however often it is queued', () => {
  showReward(reward('r1'));
  showReward(reward('r1'));
  jest.advanceTimersByTime(0);
  closeCurrent();
  showReward(reward('r1'));
  jest.advanceTimersByTime(1000);
  expect(shown.filter((s) => s.kind === 'reward')).toHaveLength(1);
});

it('waits while held, then resumes in order', () => {
  setCelebrationHold('startup', true);
  showReward(reward('r1'));
  enqueueCelebration(levelUp());
  jest.advanceTimersByTime(0);
  // A badge from a slower request still goes first.
  enqueueCelebration(badge());
  jest.advanceTimersByTime(1000);
  expect(shown).toHaveLength(0);

  setCelebrationHold('startup', false);
  jest.advanceTimersByTime(500);
  expect(shown.map((s) => s.kind)).toEqual(['streakBadge']);
});

it('runs an idle callback only after the whole sequence has finished', () => {
  const onIdle = jest.fn();
  enqueueCelebration(badge());
  showReward(reward('r1'));
  enqueueCelebration(levelUp());
  jest.advanceTimersByTime(0);
  closeCurrent();

  // The reward screen asks for the wallet as it closes.
  shown[1].done();
  whenCelebrationsIdle(onIdle);
  jest.advanceTimersByTime(1000);
  expect(shown[2].kind).toBe('levelUp');
  expect(onIdle).not.toHaveBeenCalled();

  closeCurrent();
  expect(onIdle).toHaveBeenCalledTimes(1);
});

it('waits for a screen that is not mounted yet (cold start)', () => {
  unregister.splice(0).forEach((u) => u());
  showReward(reward('r1'));
  jest.advanceTimersByTime(1000);
  expect(useCelebrationStore.getState().current).toBeNull();
  expect(useCelebrationStore.getState().queue).toHaveLength(1);

  unregister.push(registerCelebrationPresenter('reward', (_o, done) => shown.push({ kind: 'reward', done })));
  expect(shown.map((s) => s.kind)).toEqual(['reward']);
});

// D10: "Got it!" on a reward card opens the wallet through
// whenCelebrationsIdle. Until that has run, the store reports idlePending,
// so Home's Day Complete summary doesn't open over the wallet.
it('reports idlePending from "Got it!" until the wallet has been opened', () => {
  showReward(reward('r1'));
  jest.advanceTimersByTime(0);
  expect(useCelebrationStore.getState().idlePending).toBe(false);

  const openWallet = jest.fn();
  shown[0].done();
  whenCelebrationsIdle(openWallet);
  expect(useCelebrationStore.getState().idlePending).toBe(true);
  expect(openWallet).not.toHaveBeenCalled();

  jest.advanceTimersByTime(500);
  expect(openWallet).toHaveBeenCalledTimes(1);
  expect(useCelebrationStore.getState().idlePending).toBe(false);
});

it('idlePending stays on while a hold keeps the wallet from opening, and resetCelebrations clears it', () => {
  setCelebrationHold('home', true);
  whenCelebrationsIdle(jest.fn());
  jest.advanceTimersByTime(2000);
  expect(useCelebrationStore.getState().idlePending).toBe(true);
  resetCelebrations();
  setCelebrationHold('home', false);
  expect(useCelebrationStore.getState().idlePending).toBe(false);
});
