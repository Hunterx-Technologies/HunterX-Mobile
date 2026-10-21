import { create } from 'zustand';
import type { FlightRect } from '@/components/features/streaks/StreakBadgeShowcase';
import type { StreakBreakCardProps } from '@/components/features/streaks/StreakBreakCard';

export type StreakBreakOptions = Omit<
  StreakBreakCardProps,
  'onClose' | 'haptics' | 'sound' | 'getFlightTarget' | 'onLanded'
> & {
  /** Called after the card closes. */
  onDone?: () => void;
};

type PillLocator = () => Promise<FlightRect | null>;

interface StreakBreakState {
  visible: boolean;
  options: StreakBreakOptions | null;
  showStreakBreak: (options: StreakBreakOptions) => void;
  hideStreakBreak: () => void;

  // The card's button flies the flame into the home header's streak pill.
  /** Set by the home screen: scrolls to the header and measures the pill's flame icon. */
  pillLocator: PillLocator | null;
  setPillLocator: (locator: PillLocator) => () => void;
  /** When the flame last landed; the pill pops when it changes. */
  pillLandedAt: number | null;
  landOnPill: () => void;
}

export const useStreakBreakStore = create<StreakBreakState>((set, get) => ({
  visible: false,
  options: null,
  showStreakBreak: (options) => set({ visible: true, options }),
  hideStreakBreak: () => {
    const done = get().options?.onDone;
    set({ visible: false });
    done?.();
  },

  pillLocator: null,
  setPillLocator: (locator) => {
    set({ pillLocator: locator });
    return () => {
      if (get().pillLocator === locator) set({ pillLocator: null });
    };
  },
  pillLandedAt: null,
  landOnPill: () => set({ pillLandedAt: Date.now() }),
}));

/** Shows the "streak life lost" card over whatever is on screen. */
export const showStreakBreak = (options: StreakBreakOptions) => {
  useStreakBreakStore.getState().showStreakBreak(options);
};
