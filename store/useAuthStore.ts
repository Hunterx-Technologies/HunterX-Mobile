import { create } from 'zustand';

import * as authService from '@/services/api/auth.service';
import { tokenStorage } from '@/services/api/tokenStorage';
import { clearPendingReferral, getPendingReferral } from '@/services/referral/pendingReferral';
import { unregisterDevice } from '@/services/notifications/push';
import { useNotificationStore } from '@/store/useNotificationStore';
import type { User } from '@/types/user';
import { API_ERROR, getApiErrorCode } from '@/services/api/errors';

type AuthState = {
  user: User | null;
  isAuthenticating: boolean;
  isOnboarded: boolean;
  // True until restoreSession() resolves on app start. Routing decisions
  // (see app/index.tsx) must wait for this — otherwise a page refresh sees
  // the initial user:null before the stored session has a chance to load
  // and bounces straight to login even though the tokens are still valid.
  isBootstrapping: boolean;
  /** The stored session's account no longer exists (deleted); the login screen says so once. */
  accountNotFound: boolean;
  clearAccountNotFound: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: authService.RegisterPayload) => Promise<void>;
  loginWithGoogle: (
    idToken: string,
    onboarding?: authService.OnboardingAnswerPayload[]
  ) => Promise<{ isNew: boolean }>;
  loginWithApple: (
    idToken: string,
    nonce: string,
    onboarding?: authService.OnboardingAnswerPayload[]
  ) => Promise<{ isNew: boolean }>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  completeOnboarding: () => void;
  submitOnboarding: (onboarding: authService.OnboardingAnswerPayload[]) => Promise<void>;
  restoreSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticating: false,
  isOnboarded: true,
  isBootstrapping: true,
  accountNotFound: false,
  clearAccountNotFound: () => set({ accountNotFound: false }),

  login: async (email, password) => {
    set({ isAuthenticating: true });
    try {
      const user = await authService.login(email, password);
      set({ user, isOnboarded: !!user.onboarding_done });
    } finally {
      set({ isAuthenticating: false });
    }
  },

  signup: async (payload) => {
    set({ isAuthenticating: true });
    try {
      // Saved from a Guest Pass link, or typed on the signup screen.
      const referral_code = payload.referral_code || (await getPendingReferral()) || undefined;
      const user = await authService.signup({ ...payload, referral_code });
      await clearPendingReferral();
      set({ user, isOnboarded: false });
    } finally {
      set({ isAuthenticating: false });
    }
  },

  loginWithGoogle: async (idToken, onboarding = []) => {
    set({ isAuthenticating: true });
    try {
      const referralCode = (await getPendingReferral()) || undefined;
      const { user, isNew } = await authService.loginWithGoogle(idToken, onboarding, referralCode);
      await clearPendingReferral();
      set({ user, isOnboarded: !isNew });
      return { isNew };
    } finally {
      set({ isAuthenticating: false });
    }
  },

  loginWithApple: async (idToken, nonce, onboarding = []) => {
    set({ isAuthenticating: true });
    try {
      const referralCode = (await getPendingReferral()) || undefined;
      const { user, isNew } = await authService.loginWithApple(idToken, nonce, onboarding, referralCode);
      await clearPendingReferral();
      set({ user, isOnboarded: !isNew });
      return { isNew };
    } finally {
      set({ isAuthenticating: false });
    }
  },

  logout: async () => {
    // Before the session is cleared — the backend DELETE needs auth. Stops
    // this device receiving the signed-out user's pushes.
    await unregisterDevice();
    await authService.logout();
    useNotificationStore.getState().setUnreadCount(0);
    set({ user: null });
  },

  setUser: (user) => set({ user }),
  completeOnboarding: () => set({ isOnboarded: true }),

  submitOnboarding: async (onboarding) => {
    set({ isAuthenticating: true });
    try {
      const user = await authService.completeOnboarding(onboarding);
      set({ user, isOnboarded: true });
    } finally {
      set({ isAuthenticating: false });
    }
  },

  restoreSession: async () => {
    try {
      const accessToken = await tokenStorage.getAccessToken();
      if (!accessToken) {
        set({ isBootstrapping: false });
        return;
      }
      const user = await authService.getCurrentUser();
      set({ user, isOnboarded: !!user.onboarding_done, isBootstrapping: false });
    } catch (err) {
      // Token missing/expired and refresh (handled inside apiClient) failed
      // too — or the account was deleted after its 30-day grace period.
      await tokenStorage.clearTokens();
      set({
        user: null,
        isBootstrapping: false,
        accountNotFound: getApiErrorCode(err) === API_ERROR.ACCOUNT_NOT_FOUND,
      });
    }
  },
}));
