import { create } from 'zustand';

/**
 * Home's toasts and first-quest bottom sheet. They change often (every quest
 * tap), so they live here and are drawn by <HomeOverlays>, instead of being
 * state on the Home screen, where each change re-rendered all of Home.
 * Home itself only subscribes to `sheet.visible` (it holds celebrations back
 * while the sheet is open).
 */
type CompletedToast = { visible: boolean; title: string; subtitle: string; xp: number };
type ErrorToast = { visible: boolean; title: string; subtitle: string };
type TaskSheet = { visible: boolean; title: string; subtitle?: string; xp: number };

type HomeOverlayState = {
  completedToast: CompletedToast;
  errorToast: ErrorToast;
  sheet: TaskSheet;
  showCompletedToast: (toast: Omit<CompletedToast, 'visible'>) => void;
  hideCompletedToast: () => void;
  showErrorToast: (title: string, subtitle: string) => void;
  hideErrorToast: () => void;
  showTaskSheet: (sheet: Omit<TaskSheet, 'visible'>) => void;
  hideTaskSheet: () => void;
  reset: () => void;
};

const INITIAL = {
  completedToast: { visible: false, title: 'Task Completed!', subtitle: 'Great job, hunter!', xp: 10 },
  errorToast: { visible: false, title: 'Action Failed', subtitle: '' },
  sheet: { visible: false, title: 'You started your proof of health streak!', subtitle: undefined, xp: 10 },
};

export const useHomeOverlayStore = create<HomeOverlayState>((set) => ({
  ...INITIAL,
  showCompletedToast: (toast) => set({ completedToast: { ...toast, visible: true } }),
  hideCompletedToast: () => set((s) => (s.completedToast.visible ? { completedToast: { ...s.completedToast, visible: false } } : s)),
  showErrorToast: (title, subtitle) => set({ errorToast: { title, subtitle, visible: true } }),
  hideErrorToast: () => set((s) => (s.errorToast.visible ? { errorToast: { ...s.errorToast, visible: false } } : s)),
  showTaskSheet: (sheet) => set({ sheet: { ...sheet, visible: true } }),
  hideTaskSheet: () => set((s) => (s.sheet.visible ? { sheet: { ...s.sheet, visible: false } } : s)),
  reset: () => set(INITIAL),
}));

/** Show Home's red error toast (title + message). */
export const showHomeErrorToast = (title: string, subtitle: string) =>
  useHomeOverlayStore.getState().showErrorToast(title, subtitle);
