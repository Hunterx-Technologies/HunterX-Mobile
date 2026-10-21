import { create } from 'zustand';
import type { FlightRect, StreakBadgeShowcaseProps } from '@/components/features/streaks/StreakBadgeShowcase';

export type StreakBadgeOptions = Omit<
  StreakBadgeShowcaseProps,
  'onClose' | 'onContinue' | 'getFlightTarget' | 'onLanded' | 'sound' | 'haptics'
> & {
  /** Called after the popup closes, by either the ✕ or the button. */
  onDone?: () => void;
};

type BadgeLocator = (badgeId: number) => Promise<FlightRect | null>;

interface StreakBadgeState {
  visible: boolean;
  options: StreakBadgeOptions | null;
  showStreakBadge: (options: StreakBadgeOptions) => void;
  hideStreakBadge: () => void;

  // Landing on the home screen's badge section.
  /** Badges earned in this session; shown unlocked before the API catches up. */
  earnedIds: number[];
  /** The latest landing; the home badge slot pops when it changes. */
  landing: { id: number; at: number } | null;
  /** Set by the home badge carousel: brings a badge's slot into view and measures it. */
  locator: BadgeLocator | null;
  /** Set by the home screen: scrolls it by `dy` pixels. */
  homeScroller: ((dy: number) => void) | null;
  setLocator: (locator: BadgeLocator) => () => void;
  setHomeScroller: (scroller: (dy: number) => void) => () => void;
  landBadge: (badgeId: number) => void;
}

export const useStreakBadgeStore = create<StreakBadgeState>((set, get) => ({
  visible: false,
  options: null,
  showStreakBadge: (options) => set({ visible: true, options }),
  hideStreakBadge: () => {
    const done = get().options?.onDone;
    set({ visible: false });
    done?.();
  },

  earnedIds: [],
  landing: null,
  locator: null,
  homeScroller: null,
  setLocator: (locator) => {
    set({ locator });
    return () => {
      if (get().locator === locator) set({ locator: null });
    };
  },
  setHomeScroller: (homeScroller) => {
    set({ homeScroller });
    return () => {
      if (get().homeScroller === homeScroller) set({ homeScroller: null });
    };
  },
  landBadge: (badgeId) =>
    set((state) => ({
      earnedIds: state.earnedIds.includes(badgeId) ? state.earnedIds : [...state.earnedIds, badgeId],
      landing: { id: badgeId, at: Date.now() },
    })),
}));

/** Shows the streak badge popup over whatever is on screen. */
export const showStreakBadge = (options: StreakBadgeOptions) => {
  useStreakBadgeStore.getState().showStreakBadge(options);
};
