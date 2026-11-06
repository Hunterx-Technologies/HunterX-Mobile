import { create } from 'zustand';

import * as authService from '@/services/api/auth.service';
import { tokenStorage } from '@/services/api/tokenStorage';
import { clearPendingReferral, getPendingReferral } from '@/services/referral/pendingReferral';
import { unregisterDevice } from '@/services/notifications/push';
import { signOutGoogle } from '@/services/auth/googleAuth';
import { setSessionExpiredHandler } from '@/services/api/client';
import { resetUserState } from '@/store/resetUserState';
import { pickedRoutineTaskIds } from '@/store/useOnboardingStore';
import type { User } from '@/types/user';
import { API_ERROR, getApiErrorCode } from '@/services/api/errors';
import type { AppleSignInResult } from '@/services/auth/appleAuth';

/**
 * isOnboarded: the account has finished onboarding — the routes decide
 * between Home and the wizard from this.
 * justOnboarded: this call finished it — show Ascension first.
 */
type SocialLoginOutcome = { isOnboarded: boolean; justOnboarded: boolean };

// Onboarding state comes from the account itself, never from isNew — an
// account that exists but never finished the wizard (closed the app
// mid-way) comes back isNew:false. Wizard answers sent from the Signup
// screen for such an account are attached here when the backend didn't.
async function resolveSocialLogin(
  { user, isNew }: authService.SocialLoginResult,
  onboarding: authService.OnboardingAnswerPayload[],
  routineTaskIds: string[]
): Promise<{ user: User; justOnboarded: boolean }> {
  if (user.onboarding_done || onboarding.length === 0) {
    return { user, justOnboarded: isNew && !!user.onboarding_done };
  }
  // When linking by email the backend does save the answers but returns
  // the user from before — refetch before attaching them again.
  let fresh = await authService.getCurrentUser();
  if (!fresh.onboarding_done) {
    fresh = await authService.completeOnboarding(onboarding, routineTaskIds);
  }
  return { user: fresh, justOnboarded: true };
}

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
  ) => Promise<SocialLoginOutcome>;
  loginWithApple: (
    credential: AppleSignInResult,
    onboarding?: authService.OnboardingAnswerPayload[]
  ) => Promise<SocialLoginOutcome>;
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
      const routine_task_ids = payload.routine_task_ids ?? pickedRoutineTaskIds();
      const user = await authService.signup({ ...payload, referral_code, routine_task_ids });
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
      // Routine picks only ride along with wizard answers (Signup screen);
      // the Login screen sends none and the wizard runs afterwards.
      const routineTaskIds = onboarding.length > 0 ? pickedRoutineTaskIds() : [];
      const result = await authService.loginWithGoogle(idToken, onboarding, referralCode, routineTaskIds);
      await clearPendingReferral();
      const { user, justOnboarded } = await resolveSocialLogin(result, onboarding, routineTaskIds);
      // Held false through Ascension (which flips it) so the route guards
      // don't skip that screen.
      set({ user, isOnboarded: !!user.onboarding_done && !justOnboarded });
      return { isOnboarded: !!user.onboarding_done, justOnboarded };
    } finally {
      set({ isAuthenticating: false });
    }
  },

  loginWithApple: async (credential, onboarding = []) => {
    set({ isAuthenticating: true });
    try {
      const referralCode = (await getPendingReferral()) || undefined;
      const routineTaskIds = onboarding.length > 0 ? pickedRoutineTaskIds() : [];
      const result = await authService.loginWithApple(credential, onboarding, referralCode, routineTaskIds);
      await clearPendingReferral();
      const { user, justOnboarded } = await resolveSocialLogin(result, onboarding, routineTaskIds);
      set({ user, isOnboarded: !!user.onboarding_done && !justOnboarded });
      return { isOnboarded: !!user.onboarding_done, justOnboarded };
    } finally {
      set({ isAuthenticating: false });
    }
  },

  logout: async () => {
    // Before the session is cleared — the backend DELETE needs auth. Stops
    // this device receiving the signed-out user's pushes.
    await unregisterDevice();
    await authService.logout();
    await signOutGoogle();
    resetUserState();
    set({ user: null });
  },

  setUser: (user) => set({ user }),
  completeOnboarding: () => set({ isOnboarded: true }),

  submitOnboarding: async (onboarding) => {
    set({ isAuthenticating: true });
    try {
      const referralCode = (await getPendingReferral()) || undefined;
      const user = await authService.completeOnboarding(onboarding, pickedRoutineTaskIds(), referralCode);
      await clearPendingReferral();
      // isOnboarded stays false until Ascension flips it — set here, the
      // onboarding layout would redirect to Home and skip that screen.
      set({ user });
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

// The refresh token was refused (expired, revoked, account deleted or
// suspended): sign out, so the route guards send the hunter to Login
// instead of leaving every request failing.
setSessionExpiredHandler((code) => {
  if (!useAuthStore.getState().user) return;
  resetUserState();
  useAuthStore.setState({ user: null, accountNotFound: code === API_ERROR.ACCOUNT_NOT_FOUND });
});
