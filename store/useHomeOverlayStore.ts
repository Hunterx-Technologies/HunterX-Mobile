import { create } from 'zustand';

/**
 * Home's toasts. They change often (every quest tap), so they live here and
 * are drawn by <HomeOverlays>, instead of being state on the Home screen,
 * where each change re-rendered all of Home.
 */
type CompletedToast = { visible: boolean; title: string; subtitle: string; xp: number };
type ErrorToast = { visible: boolean; title: string; subtitle: string };

type HomeOverlayState = {
  completedToast: CompletedToast;
  errorToast: ErrorToast;
  showCompletedToast: (toast: Omit<CompletedToast, 'visible'>) => void;
  hideCompletedToast: () => void;
  showErrorToast: (title: string, subtitle: string) => void;
  hideErrorToast: () => void;
  reset: () => void;
};

const INITIAL = {
  completedToast: { visible: false, title: 'Task Completed!', subtitle: 'Great job, hunter!', xp: 10 },
  errorToast: { visible: false, title: 'Action Failed', subtitle: '' },
};

export const useHomeOverlayStore = create<HomeOverlayState>((set) => ({
  ...INITIAL,
  showCompletedToast: (toast) => set({ completedToast: { ...toast, visible: true } }),
  hideCompletedToast: () => set((s) => (s.completedToast.visible ? { completedToast: { ...s.completedToast, visible: false } } : s)),
  showErrorToast: (title, subtitle) => set({ errorToast: { title, subtitle, visible: true } }),
  hideErrorToast: () => set((s) => (s.errorToast.visible ? { errorToast: { ...s.errorToast, visible: false } } : s)),
  reset: () => set(INITIAL),
}));

/** Show Home's red error toast (title + message). */
export const showHomeErrorToast = (title: string, subtitle: string) =>
  useHomeOverlayStore.getState().showErrorToast(title, subtitle);
