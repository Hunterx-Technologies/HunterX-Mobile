import type { RefObject } from 'react';
import type { View } from 'react-native';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setCelebrationHold } from '@/store/useCelebrationStore';
import { TUTORIAL_STEPS } from '@/components/features/tutorial/tutorialSteps';

/**
 * The first-visit app tour (coach marks over Home, the tab bar and Battles).
 * It's started from Home only — never on login, onboarding or password
 * screens — and shown once per account on this device. Profile > "Replay app
 * tour" starts it again.
 */

const SEEN_KEY_PREFIX = 'hunterx-app-tour-seen-v1_';
const seenKey = (userId: string | number) => `${SEEN_KEY_PREFIX}${userId}`;

export async function hasSeenTutorial(userId: string | number): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(seenKey(userId))) === 'true';
  } catch {
    // Storage unreadable: don't risk showing the tour on every launch.
    return true;
  }
}

function markTutorialSeen(userId: string | number | null) {
  if (userId == null) return;
  AsyncStorage.setItem(seenKey(userId), 'true').catch(() => {});
}

// ---- Targets: views the tour can spotlight, registered by <TutorialTarget> ----

const targets = new Map<string, RefObject<View | null>>();

export function registerTutorialTarget(id: string, ref: RefObject<View | null>) {
  targets.set(id, ref);
  return () => {
    // A newer mount of the same id may have replaced this one.
    if (targets.get(id) === ref) targets.delete(id);
  };
}

export type TutorialRect = { x: number; y: number; width: number; height: number };

/** Where a target is on screen, or null if it isn't mounted / laid out yet. */
export function measureTutorialTarget(id: string): Promise<TutorialRect | null> {
  return new Promise((resolve) => {
    const view = targets.get(id)?.current;
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) =>
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null)
    );
  });
}

// ---- Scrollable tabs, so the tour can bring a section into view ----

/** Each returns how far the screen will actually scroll (it starts animating). */
export type TutorialScroller = { scrollBy: (dy: number) => number; scrollToTop: () => number };
export type TutorialScrollScreen = 'home' | 'profile';
const scrollers = new Map<TutorialScrollScreen, TutorialScroller>();

export function setTutorialScroller(screen: TutorialScrollScreen, scroller: TutorialScroller) {
  scrollers.set(screen, scroller);
  return () => {
    if (scrollers.get(screen) === scroller) scrollers.delete(screen);
  };
}

export const tutorialScroll = (screen: TutorialScrollScreen) => ({
  by: (dy: number) => scrollers.get(screen)?.scrollBy(dy) ?? 0,
  toTop: () => scrollers.get(screen)?.scrollToTop() ?? 0,
});

/**
 * A scroller for a ScrollView: wire `onScroll`, `onContentSizeChange` and
 * `onLayout` to the returned handlers, and pass `scroller` to setTutorialScroller.
 */
export function makeTutorialScroller(scrollTo: (y: number) => void) {
  const m = { y: 0, contentH: 0, viewportH: 0 };
  const scroller: TutorialScroller = {
    scrollBy: (dy) => {
      const to = Math.min(Math.max(0, m.contentH - m.viewportH), Math.max(0, m.y + dy));
      scrollTo(to);
      return to - m.y;
    },
    scrollToTop: () => {
      scrollTo(0);
      return -m.y;
    },
  };
  return {
    scroller,
    metrics: m,
    onContentSizeChange: (_w: number, h: number) => {
      m.contentH = h;
    },
    onLayout: (e: { nativeEvent: { layout: { height: number } } }) => {
      m.viewportH = e.nativeEvent.layout.height;
    },
  };
}

// ---- Tour state ----

type TutorialState = {
  active: boolean;
  stepIndex: number;
  userId: string | number | null;
  start: (userId: string | number | null) => void;
  next: () => void;
  back: () => void;
  /** Ends the tour (finished or skipped) and remembers it was seen. */
  finish: () => void;
  /** Ends the tour without marking it seen (sign-out). */
  stop: () => void;
};

export const useTutorialStore = create<TutorialState>((set, get) => ({
  active: false,
  stepIndex: 0,
  userId: null,
  start: (userId) => {
    if (get().active) return;
    setCelebrationHold('tutorial', true);
    set({ active: true, stepIndex: 0, userId });
  },
  next: () => {
    const { stepIndex, active } = get();
    if (!active) return;
    if (stepIndex >= TUTORIAL_STEPS.length - 1) get().finish();
    else set({ stepIndex: stepIndex + 1 });
  },
  back: () => {
    const { stepIndex, active } = get();
    if (active && stepIndex > 0) set({ stepIndex: stepIndex - 1 });
  },
  finish: () => {
    markTutorialSeen(get().userId);
    setCelebrationHold('tutorial', false);
    set({ active: false, stepIndex: 0 });
  },
  stop: () => {
    setCelebrationHold('tutorial', false);
    set({ active: false, stepIndex: 0, userId: null });
  },
}));
