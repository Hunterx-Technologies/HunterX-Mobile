import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
import { markOffline, whenOnline } from '@/store/useConnectivityStore';

// The signed-in user's last known profile, so opening the app offline lands
// on Home instead of Login. Written whenever the user changes, removed on
// sign-out / session end. Tokens stay in secure storage as before.
const CACHED_USER_KEY = 'hunterx-cached-user-v1';

// Longest sign-out waits for the server before signing out locally anyway.
const LOGOUT_SERVER_WAIT_MS = 3000;

async function readCachedUser(): Promise<User | null> {
  try {
    const json = await AsyncStorage.getItem(CACHED_USER_KEY);
    return json ? (JSON.parse(json) as User) : null;
  } catch {
    return null;
  }
}

/**
 * Did the server actually refuse this session (expired/revoked token, deleted
 * account)? Only then is the stored session thrown away. No response at all
 * (offline, timeout) or a 5xx is not a refusal — the tokens are kept.
 */
function isSessionRefused(err: unknown): boolean {
  const status = (err as any)?.status ?? (err as any)?.response?.status;
  return (
    getApiErrorCode(err) === API_ERROR.ACCOUNT_NOT_FOUND ||
    (typeof status === 'number' && [400, 401, 403, 404].includes(status))
  );
}

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
    // Server-side cleanup, both at once and best-effort:
    // - unregister this device from push (needs auth, so before the tokens
    //   are cleared) — stops the signed-out user's pushes arriving here;
    // - revoke the refresh token.
    // Capped at LOGOUT_SERVER_WAIT_MS: on a slow or flaky network these used
    // to hold sign-out for 30s+ with nothing on screen, which looked like the
    // Log Out button doing nothing. Whatever hasn't finished by then carries
    // on in the background; signing out on this device never waits on it.
    const refreshToken = await tokenStorage.getRefreshToken();
    const serverCleanup = Promise.allSettled([
      unregisterDevice(),
      refreshToken ? authService.revokeSession(refreshToken) : Promise.resolve(),
    ]);
    await Promise.race([serverCleanup, new Promise((r) => setTimeout(r, LOGOUT_SERVER_WAIT_MS))]);

    await tokenStorage.clearTokens();
    signOutGoogle().catch(() => {}); // local SDK state only; never block on it
    resetUserState();
    set({ user: null });
  },

  setUser: (user) => set({ user }),
  // Ascension calls this to let the hunter into Home. Only the server's
  // record counts: reaching Ascension without saved answers (deep link,
  // OTP fallback) must not open the app.
  completeOnboarding: () => set((s) => ({ isOnboarded: !!s.user?.onboarding_done })),

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
      if (isSessionRefused(err)) {
        // Token expired and refresh (handled inside apiClient) failed too —
        // or the account was deleted after its 30-day grace period.
        await tokenStorage.clearTokens();
        set({
          user: null,
          isBootstrapping: false,
          accountNotFound: getApiErrorCode(err) === API_ERROR.ACCOUNT_NOT_FOUND,
        });
        return;
      }

      // Offline (or the server is having a moment): keep the session. Open
      // with the last known profile, and refresh it once we're back online.
      markOffline();
      const cached = await readCachedUser();
      if (cached) {
        set({ user: cached, isOnboarded: !!cached.onboarding_done, isBootstrapping: false });
        whenOnline().then(() => {
          if (useAuthStore.getState().user) {
            authService
              .getCurrentUser()
              .then((fresh) => set({ user: fresh, isOnboarded: !!fresh.onboarding_done }))
              .catch((e) => {
                if (isSessionRefused(e)) {
                  tokenStorage.clearTokens();
                  set({ user: null });
                }
              });
          }
        });
        return;
      }
      // Nothing cached (e.g. first launch after an update): stay on the
      // loading screen behind the offline pop-up and try again once online,
      // rather than sending a signed-in hunter to Login.
      whenOnline().then(() => useAuthStore.getState().restoreSession());
    }
  },

}));

// Keep the cached profile in step with the signed-in user (and drop it on
// sign-out / session end, when user becomes null).
useAuthStore.subscribe((state, prev) => {
  if (state.user === prev.user) return;
  if (state.user) {
    AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(state.user)).catch(() => {});
  } else {
    AsyncStorage.removeItem(CACHED_USER_KEY).catch(() => {});
  }
});

// The refresh token was refused (expired, revoked, account deleted or
// suspended): sign out, so the route guards send the hunter to Login
// instead of leaving every request failing.
setSessionExpiredHandler((code) => {
  if (!useAuthStore.getState().user) return;
  resetUserState();
  useAuthStore.setState({ user: null, accountNotFound: code === API_ERROR.ACCOUNT_NOT_FOUND });
});
