// A quest that completes a 7-day streak: its reward card and level-up wait
// for the new badge, so the badge plays first.

const mockFetchBadges = jest.fn();
jest.mock('@/services/api/user.service', () => ({ fetchUnseenStreakBadges: () => mockFetchBadges() }));
jest.mock('@/services/celebrations/seenOutbox', () => ({
  flushSeenOutbox: jest.fn(),
  markCelebrationSeen: jest.fn(),
  withoutClaimed: async <T,>(_kind: string, items: T[]) => items,
}));
const mockShowStreakBadge = jest.fn();
jest.mock('@/store/useStreakBadgeStore', () => ({ showStreakBadge: (o: unknown) => mockShowStreakBadge(o) }));
jest.mock('@/components/features/streaks/StreakBadgesCarousel', () => ({
  STREAK_BADGES_DATA: [{ dayNumber: 3 }, { dayNumber: 7 }],
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

type Sync = typeof import('@/hooks/useStreakBadgeSync');
// Fresh module state (in-flight request, badges already queued) per test.
let syncStreakBadges: Sync['syncStreakBadges'];
let syncStreakBadgesThen: Sync['syncStreakBadgesThen'];
beforeEach(() => {
  jest.isolateModules(() => {
    ({ syncStreakBadges, syncStreakBadgesThen } = require('@/hooks/useStreakBadgeSync'));
  });
});

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  mockFetchBadges.mockReset();
  mockShowStreakBadge.mockReset();
});
afterEach(() => jest.useRealTimers());

it('queues the badge before the rest', async () => {
  const order: string[] = [];
  mockShowStreakBadge.mockImplementation(() => order.push('badge'));
  mockFetchBadges.mockResolvedValue([{ id: 'b7', streak_days: 7 }]);

  syncStreakBadgesThen(() => order.push('rest'));
  await settle();
  expect(order).toEqual(['badge', 'rest']);

  jest.advanceTimersByTime(10_000);
  expect(order).toEqual(['badge', 'rest']);
});

it('does not hold the rest back for long when the badge request hangs', async () => {
  const rest = jest.fn();
  mockFetchBadges.mockReturnValue(new Promise(() => {}));
  syncStreakBadgesThen(rest);
  jest.advanceTimersByTime(3999);
  expect(rest).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(rest).toHaveBeenCalledTimes(1);
});

it('still queues the rest when the badge request fails (offline)', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const rest = jest.fn();
  mockFetchBadges.mockRejectedValue(new Error('Network Error'));
  syncStreakBadgesThen(rest);
  await settle();
  expect(rest).toHaveBeenCalledTimes(1);
});

it('a sync asked for mid-request runs again, and callers wait for that too', async () => {
  let first!: (v: unknown) => void;
  mockFetchBadges
    .mockReturnValueOnce(new Promise((r) => (first = r)))
    .mockResolvedValueOnce([{ id: 'b7b', streak_days: 7 }]);
  const a = syncStreakBadges();
  const done = jest.fn();
  syncStreakBadges().then(done);
  first([]);
  await a;
  await settle();
  expect(mockFetchBadges).toHaveBeenCalledTimes(2);
  expect(mockShowStreakBadge).toHaveBeenCalledTimes(1);
  expect(done).toHaveBeenCalled();
});
