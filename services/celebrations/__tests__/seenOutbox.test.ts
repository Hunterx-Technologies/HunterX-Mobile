// Claimed celebrations must never replay — not after a failed "seen" call,
// not after the app is killed straight after claiming.

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStorage.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mockStorage.set(k, v);
    }),
  },
}));

const mockMarkRewardSeen = jest.fn<Promise<void>, [string]>();
const mockMarkBadgesSeen = jest.fn<Promise<void>, [string[]]>();
const mockMarkLevelUpsSeen = jest.fn<Promise<void>, [string[]]>();
jest.mock('@/services/api/rewards.service', () => ({ markRewardSeen: (id: string) => mockMarkRewardSeen(id) }));
jest.mock('@/services/api/user.service', () => ({
  markStreakBadgesSeen: (ids: string[]) => mockMarkBadgesSeen(ids),
  markLevelUpsSeen: (ids: string[]) => mockMarkLevelUpsSeen(ids),
}));
let mockUserId: string | null = 'u1';
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ user: mockUserId ? { id: mockUserId } : null }) },
}));

type Outbox = typeof import('@/services/celebrations/seenOutbox');
/** A fresh copy of the module: what a cold start (after a force-close) sees. */
const coldStart = (): Outbox => {
  let mod!: Outbox;
  jest.isolateModules(() => {
    mod = require('@/services/celebrations/seenOutbox');
  });
  return mod;
};

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const offline = () => Promise.reject(new Error('Network Error'));

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockStorage.clear();
  mockUserId = 'u1';
  [mockMarkRewardSeen, mockMarkBadgesSeen, mockMarkLevelUpsSeen].forEach((m) => {
    m.mockReset();
    m.mockResolvedValue(undefined);
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('tells the server and forgets the claim once it is confirmed', async () => {
  const outbox = coldStart();
  outbox.markCelebrationSeen('streakBadge', ['b1']);
  await settle();
  expect(mockMarkBadgesSeen).toHaveBeenCalledWith(['b1']);
  // Confirmed: the server's own unseen list is trusted again.
  expect(await outbox.withoutClaimed('streakBadge', [{ id: 'b1' }], (b) => b.id)).toEqual([{ id: 'b1' }]);
});

it('hides a claimed card while its "seen" call is failing, and retries', async () => {
  mockMarkRewardSeen.mockImplementation(offline);
  const outbox = coldStart();
  outbox.markCelebrationSeen('reward', ['r1']);
  await settle();
  expect(mockMarkRewardSeen).toHaveBeenCalledTimes(1);
  expect(await outbox.withoutClaimed('reward', [{ id: 'r1' }, { id: 'r2' }], (r) => r.id)).toEqual([{ id: 'r2' }]);

  // Back online: the retry goes through.
  mockMarkRewardSeen.mockResolvedValue(undefined);
  jest.advanceTimersByTime(1500);
  await settle();
  expect(mockMarkRewardSeen).toHaveBeenCalledTimes(2);
  expect(await outbox.withoutClaimed('reward', [{ id: 'r1' }], (r) => r.id)).toEqual([{ id: 'r1' }]);
});

it('survives a force-close: the claim is still hidden and sent on the next launch', async () => {
  mockMarkLevelUpsSeen.mockImplementation(offline);
  mockMarkBadgesSeen.mockImplementation(offline);
  const before = coldStart();
  before.markCelebrationSeen('levelUp', ['e1', 'e2']);
  before.markCelebrationSeen('streakBadge', ['b1']);
  await settle();

  // App killed here, reopened online.
  mockMarkLevelUpsSeen.mockResolvedValue(undefined);
  mockMarkBadgesSeen.mockResolvedValue(undefined);
  const after = coldStart();
  expect(await after.withoutClaimed('levelUp', ['e1', 'e2'], (id) => id)).toEqual([]);
  expect(await after.withoutClaimed('streakBadge', [{ id: 'b1' }], (b) => b.id)).toEqual([]);

  await after.flushSeenOutbox();
  expect(mockMarkLevelUpsSeen).toHaveBeenLastCalledWith(['e1', 'e2']);
  expect(mockMarkBadgesSeen).toHaveBeenLastCalledWith(['b1']);
});

it('keeps each account separate', async () => {
  mockMarkRewardSeen.mockImplementation(offline);
  const outbox = coldStart();
  outbox.markCelebrationSeen('reward', ['r1']);
  await settle();

  outbox.resetSeenOutbox();
  mockUserId = 'u2';
  expect(await outbox.withoutClaimed('reward', [{ id: 'r1' }], (r) => r.id)).toEqual([{ id: 'r1' }]);
});

it('sends a claim made while an earlier call is still in flight', async () => {
  let finish!: () => void;
  mockMarkBadgesSeen.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
  const outbox = coldStart();
  outbox.markCelebrationSeen('streakBadge', ['b1']);
  await settle();
  outbox.markCelebrationSeen('streakBadge', ['b2']);
  await settle();
  finish();
  await settle();
  expect(mockMarkBadgesSeen.mock.calls).toEqual([[['b1']], [['b2']]]);
});

const refused = (status: number) => Promise.reject(Object.assign(new Error('Reward not found'), { status }));

it('drops a claim the server refuses for good (404), instead of retrying it every launch', async () => {
  mockMarkRewardSeen.mockImplementation(() => refused(404));
  const outbox = coldStart();
  outbox.markCelebrationSeen('reward', ['gone']);
  await settle();
  expect(await outbox.withoutClaimed('reward', [{ id: 'gone' }], (r) => r.id)).toEqual([{ id: 'gone' }]);
  jest.advanceTimersByTime(30_000);
  await settle();
  expect(mockMarkRewardSeen).toHaveBeenCalledTimes(1);

  // Nothing left for the next launch to send.
  mockMarkRewardSeen.mockClear();
  await coldStart().flushSeenOutbox();
  expect(mockMarkRewardSeen).not.toHaveBeenCalled();
});

it('keeps retrying server errors (5xx) and offline, but not refused cards next to them', async () => {
  mockMarkRewardSeen.mockImplementation((id: string) => (id === 'gone' ? refused(404) : refused(503)));
  const outbox = coldStart();
  outbox.markCelebrationSeen('reward', ['gone', 'r1']);
  await settle();
  expect(await outbox.withoutClaimed('reward', [{ id: 'gone' }, { id: 'r1' }], (r) => r.id)).toEqual([{ id: 'gone' }]);

  mockMarkRewardSeen.mockClear();
  mockMarkRewardSeen.mockResolvedValue(undefined);
  jest.advanceTimersByTime(1500);
  await settle();
  expect(mockMarkRewardSeen.mock.calls).toEqual([['r1']]);
});
