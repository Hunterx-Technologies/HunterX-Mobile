import { create } from 'zustand';
import type { LevelUpRewardProps } from '@/components/features/levelUp/LevelUpReward';

export type LevelUpOptions = Omit<LevelUpRewardProps, 'onClose' | 'onPress' | 'sound' | 'haptics'> & {
  /** Called after the screen closes, by either button. */
  onDone?: () => void;
};

interface LevelUpState {
  visible: boolean;
  options: LevelUpOptions | null;
  showLevelUp: (options: LevelUpOptions) => void;
  hideLevelUp: () => void;
}

export const useLevelUpStore = create<LevelUpState>((set, get) => ({
  visible: false,
  options: null,
  showLevelUp: (options) => set({ visible: true, options }),
  hideLevelUp: () => {
    const done = get().options?.onDone;
    set({ visible: false });
    done?.();
  },
}));

/** Shows the level-up screen over whatever is on screen. */
export const showLevelUp = (options: LevelUpOptions) => {
  useLevelUpStore.getState().showLevelUp(options);
};
