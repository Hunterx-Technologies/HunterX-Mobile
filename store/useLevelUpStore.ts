import { create } from 'zustand';
import { enqueueCelebration } from '@/store/useCelebrationStore';
import type { LevelUpRewardProps } from '@/components/features/levelUp/LevelUpReward';
import type { LevelUpInfo } from '@/types/task';
import { markLevelUpsSeen } from '@/services/api/user.service';

export interface DragonStageStep {
  imageUrl: string;
  name: string;
  message: string;
  buttonLabel: string;
}

export type LevelUpOptions = Omit<LevelUpRewardProps, 'onClose' | 'onPress' | 'sound' | 'haptics'> & {
  /** On a rank up: shown after the level-up screen's button. */
  dragonStage?: DragonStageStep;
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

/**
 * Shows the level-up screen over whatever is on screen, after any
 * celebration already showing (see useCelebrationStore).
 */
export const showLevelUp = (options: LevelUpOptions) => {
  enqueueCelebration({ kind: 'levelUp', options });
};

/** Level-up events already queued this session — each screen shows once. */
const queuedEventIds = new Set<string>();

/**
 * Queues the level-up screen for an API `level_up` (from a completion, or
 * GET /users/me/level-up) when the level went up, and marks its events
 * seen once it closes. Every text on it comes from the API.
 */
export const showLevelUpFromApi = (info: LevelUpInfo | null | undefined) => {
  if (!info || info.to_level <= info.from_level) return;
  const ids = info.event_ids ?? [];
  if (ids.length > 0 && ids.every((id) => queuedEventIds.has(id))) return;
  ids.forEach((id) => queuedEventIds.add(id));
  const stage = info.is_rank_up ? info.dragon_stage : null;
  showLevelUp({
    level: info.to_level,
    previousLevel: info.from_level,
    bandLabel: info.level_up_label ?? '',
    eyebrow: info.level_up_label ?? '',
    title: info.level_up_title ?? '',
    rankName: info.title ?? '',
    // The rank line ("Dormant III") already names the rank; no pill repeating it.
    tierLabel: '',
    description: info.level_up_message ?? '',
    xpEarnedText: info.xp_earned_text,
    nextLevelText: info.next_level_text,
    buttonLabel: info.button_label,
    dragonStage: stage?.image_url
      ? { imageUrl: stage.image_url, name: stage.name, message: stage.message, buttonLabel: info.button_label }
      : undefined,
    onDone: () => {
      // A failed call just means it's offered again on a later launch.
      if (ids.length > 0) {
        markLevelUpsSeen(ids).catch((err: unknown) =>
          console.warn('[levelUp] mark seen failed:', err instanceof Error ? err.message : err)
        );
      }
    },
  });
};
