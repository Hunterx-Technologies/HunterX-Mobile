jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => data.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => void data.set(k, v)),
    },
  };
});

import { hasSeenTutorial, useTutorialStore } from '@/store/useTutorialStore';
import { TUTORIAL_STEPS } from '@/components/features/tutorial/tutorialSteps';
import {
  enqueueCelebration,
  registerCelebrationPresenter,
  resetCelebrations,
} from '@/store/useCelebrationStore';

const tour = () => useTutorialStore.getState();

beforeEach(() => {
  useTutorialStore.getState().stop();
});

it('steps forward and back, and finishes after the last step', async () => {
  tour().start('u1');
  expect(tour().active).toBe(true);
  tour().back();
  expect(tour().stepIndex).toBe(0);
  tour().next();
  tour().next();
  tour().back();
  expect(tour().stepIndex).toBe(1);

  for (let i = 0; i < TUTORIAL_STEPS.length; i++) tour().next();
  expect(tour().active).toBe(false);
  expect(await hasSeenTutorial('u1')).toBe(true);
});

it('is remembered per account', async () => {
  tour().start('u2');
  tour().finish();
  expect(await hasSeenTutorial('u2')).toBe(true);
  expect(await hasSeenTutorial('someone-else')).toBe(false);
});

it('stop (sign-out) ends it without marking it seen', async () => {
  tour().start('u3');
  tour().stop();
  expect(tour().active).toBe(false);
  expect(await hasSeenTutorial('u3')).toBe(false);
});

it('holds celebrations while it runs', () => {
  jest.useFakeTimers();
  resetCelebrations();
  const shown: string[] = [];
  const off = registerCelebrationPresenter('levelUp', (_next, done) => {
    shown.push('levelUp');
    done();
  });

  tour().start('u4');
  enqueueCelebration({ kind: 'levelUp', options: { level: 2 } } as Parameters<typeof enqueueCelebration>[0]);
  jest.advanceTimersByTime(1000);
  expect(shown).toEqual([]);

  tour().finish();
  jest.advanceTimersByTime(1000);
  expect(shown).toEqual(['levelUp']);

  off();
  jest.useRealTimers();
});

it('every spotlight step has a unique id and a target', () => {
  const ids = TUTORIAL_STEPS.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  // Only the first and last steps are centred cards.
  expect(TUTORIAL_STEPS.slice(1, -1).every((s) => !!s.target)).toBe(true);
});
