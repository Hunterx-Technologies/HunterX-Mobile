import { Image as ExpoImage } from 'expo-image';

import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/user';

import { apiClient } from './client';
import { tokenStorage } from './tokenStorage';
import { getApiErrorCode } from './errors';
import { AVATAR_THUMB_WIDTH, optimizeCloudinaryUrl } from '@/services/media/cloudinary';
import type { AppleSignInResult } from '@/services/auth/appleAuth';

// HunterX-Backend answers every auth call as { success, message, data }, with
// tokens as data.access_token / data.refresh_token.
type TokenPair = { access_token: string; refresh_token: string };
type AuthResponse = TokenPair & { user: any; isNew?: boolean; linked?: boolean };

// Fired every time we learn who the current user is (login, restoreSession,
// updateProfile, avatar change, ...) so their avatar is already sitting in
// expo-image's disk cache by the time the header/profile screen mounts it —
// instead of that being the one avatar in the app that's always cold.
function prefetchCurrentUserAvatar(avatarUrl: string | null | undefined) {
  if (!avatarUrl || !(avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
    return;
  }
  ExpoImage.prefetch(optimizeCloudinaryUrl(avatarUrl, AVATAR_THUMB_WIDTH), 'memory-disk').catch(() => { });
}

export function mapBackendUserToUser(u: any): User {
  if (!u) return u;
  const progression = u.user_progression || {};
  const dailyStreak = u.currentStreak ?? progression.daily_streak ?? 0;
  const weeklyStreak = u.weeklyStreak ?? progression.weekly_streak ?? (dailyStreak > 0 ? Math.min(dailyStreak, 7) : 0);
  const weekStatusCompletedCount = u.week_status?.days
    ? u.week_status.days.filter((d: any) => d.status === 'DONE' || d.status === 'COMPLETED').length
    : undefined;

  const heightInCm = u.height_cm ?? u.height;
  const weightInKg = u.weight_kg ?? u.weight;
  const dob = u.date_of_birth || u.dob || u.birthday;
  const proteinGoal = u.daily_protein_goal ?? u.protein_goal;
  const isOnboarded = u.onboarding_done ?? u.onboardingDone ?? u.is_onboarded ?? u.onboarded ?? false;
  const avatarUrl = u.avatarUrl || (u.avatar_id ? `char_${u.avatar_id}` : null);

  const rawProvider = u.auth_provider || u.authProvider || u.provider || 'EMAIL';
  const upperProvider = String(rawProvider).toUpperCase();
  const normalizedProvider = upperProvider.includes('GOOGLE')
    ? 'GOOGLE'
    : upperProvider.includes('APPLE')
      ? 'APPLE'
      : upperProvider;

  return {
    ...u,
    id: u.id ? u.id.toString() : '',
    displayName: u.name || u.displayName || 'Hunter',
    avatarUrl,
    level: u.level ?? progression.current_level ?? 1,
    xp: u.xp ?? progression.total_xp ?? 0,
    currentStreak: dailyStreak,
    longestStreak: u.longestStreak ?? progression.longest_streak ?? 0,
    weeklyStreak,
    completedDaysCount: u.completedDaysCount ?? weekStatusCompletedCount ?? weeklyStreak,
    user_progression: progression,
    week_status: u.week_status,
    height_cm: heightInCm,
    height: heightInCm,
    weight_kg: weightInKg,
    weight: weightInKg,
    date_of_birth: dob,
    dob: dob,
    birthday: dob,
    daily_protein_goal: proteinGoal,
    protein_goal: proteinGoal,
    auth_provider: normalizedProvider,
    authProvider: normalizedProvider,
    provider: normalizedProvider,
    onboarding_done: !!isOnboarded,
    // Account deletion (30-day grace period on the server). delete_at in ms
    // for the Profile banner; null when nothing is pending.
    deletionRequestedAt: u.deletionRequestedAt ?? null,
    deleteAt: u.deleteAt ?? null,
    daysLeft: u.daysLeft ?? null,
    delete_at: u.deleteAt ? Date.parse(u.deleteAt) : null,
  };
}

/** Maps the backend user and warms its avatar in the image cache. */
function toUser(raw: any): User {
  const user = mapBackendUserToUser(raw);
  prefetchCurrentUserAvatar(user?.avatarUrl);
  return user;
}

const PASSWORD_RULE_TEXT: Record<string, string> = {
  AT_LEAST_8_CHARACTERS: 'at least 8 characters',
  ONE_UPPERCASE_LETTER: 'an uppercase letter',
  ONE_NUMBER: 'a number',
  ONE_SPECIAL_CHARACTER: 'a special character',
};

function extractErrorMessage(err: any): string {
  const data = err?.response?.data;
  // Password rules the backend refused (register, reset, change password).
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const missing = data.errors.map((code: string) => PASSWORD_RULE_TEXT[code] ?? code).join(', ');
    return `Password needs ${missing}.`;
  }
  if (typeof data === 'string') return data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (typeof err?.message === 'string') return err.message;
  return 'An unexpected error occurred';
}

/** An Error with the server's message, keeping its error code (err.code) for callers to branch on. */
function apiFailure(err: any): Error & { code?: string | null; status?: number } {
  const failure = new Error(extractErrorMessage(err)) as Error & { code?: string | null; status?: number };
  failure.code = getApiErrorCode(err);
  failure.status = err?.status ?? err?.response?.status;
  return failure;
}

/** POSTs/PATCHes, turning `success: false` and HTTP errors into apiFailure. */
async function call<T>(request: () => Promise<{ data: ApiResponse<T> | any }>, failMessage: string): Promise<T> {
  let body: any;
  try {
    ({ data: body } = await request());
  } catch (err) {
    throw apiFailure(err);
  }
  if (!body || body.success === false) {
    throw new Error(body?.error?.message || body?.message || failMessage);
  }
  return body.data as T;
}

async function saveTokens(data: Partial<TokenPair> | null | undefined) {
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error('Invalid token response from backend');
  }
  await tokenStorage.setTokens(data.access_token, data.refresh_token);
}

export async function login(email: string, password: string): Promise<User> {
  const data = await call<AuthResponse>(() => apiClient.post('/auth/login', { email, password }), 'Login failed');
  await saveTokens(data);
  return toUser(data.user);
}

export type OnboardingAnswerPayload = {
  questionId: number;
  answer: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  onboarding: OnboardingAnswerPayload[];
  // Inviter's code from a Guest Pass link — unknown codes are ignored server-side.
  referral_code?: string;
  // Routine tasks picked in onboarding; none = every routine task.
  routine_task_ids?: string[];
};

export async function signup(payload: RegisterPayload): Promise<User> {
  const data = await call<AuthResponse>(() => apiClient.post('/auth/register', payload), 'Registration failed');
  await saveTokens(data);
  return toUser(data.user);
}

export type SocialLoginResult = {
  user: User;
  isNew: boolean;
};

export type GoogleLoginResult = SocialLoginResult;
export type AppleLoginResult = SocialLoginResult;

// Backend handles register-or-login in a single call for each provider
// (HunterX-Backend POST /api/auth/google and /api/auth/apple) — the same
// endpoint is used from both the Login and Signup screens' "Continue with …".
// onboarding[] only matters when the account turns out to be brand new; an
// existing user just logs in. referral_code likewise only applies on create.
async function socialLogin(
  provider: 'GOOGLE' | 'APPLE',
  path: string,
  body: Record<string, unknown>,
  failMessage: string
): Promise<SocialLoginResult> {
  const data = await call<AuthResponse>(() => apiClient.post(path, body), failMessage);
  await saveTokens(data);
  const rawUser = data.user || {};
  if (!rawUser.auth_provider && !rawUser.authProvider && !rawUser.provider) {
    rawUser.auth_provider = provider;
  }
  return { user: toUser(rawUser), isNew: !!data.isNew };
}

// Optional sign-up extras: an invite code and the routine tasks picked in
// onboarding. Left out of the body when empty.
function signupExtras(referralCode?: string, routineTaskIds: string[] = []) {
  return {
    ...(referralCode ? { referral_code: referralCode } : {}),
    ...(routineTaskIds.length > 0 ? { routine_task_ids: routineTaskIds } : {}),
  };
}

export async function loginWithGoogle(
  idToken: string,
  onboarding: OnboardingAnswerPayload[] = [],
  referralCode?: string,
  routineTaskIds: string[] = []
): Promise<GoogleLoginResult> {
  const body = { idToken, onboarding, ...signupExtras(referralCode, routineTaskIds) };
  return socialLogin('GOOGLE', '/auth/google', body, 'Google sign-in failed');
}

export async function loginWithApple(
  credential: AppleSignInResult,
  onboarding: OnboardingAnswerPayload[] = [],
  referralCode?: string,
  routineTaskIds: string[] = []
): Promise<AppleLoginResult> {
  const { idToken, nonce, authorizationCode } = credential;
  const body = {
    idToken,
    nonce,
    ...(authorizationCode ? { authorization_code: authorizationCode } : {}),
    onboarding,
    ...signupExtras(referralCode, routineTaskIds),
  };
  return socialLogin('APPLE', '/auth/apple', body, 'Apple sign-in failed');
}

// Ends this device's session on the server (revokes its refresh token, and
// any copy of it), then forgets the tokens. The server call is best-effort:
// signing out offline still clears the device.
export async function logout(): Promise<void> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (refreshToken) {
    await apiClient.post('/auth/logout', { refreshToken }, { timeout: 5000 }).catch(() => { });
  }
  await tokenStorage.clearTokens();
}

let inFlightCurrentUser: Promise<User> | null = null;

// Restores a session on app start — apiClient already attaches the stored
// access token (and transparently refreshes it on a 401), so this just
// confirms it's still valid and fetches the user it belongs to.
export async function getCurrentUser(): Promise<User> {
  if (inFlightCurrentUser) {
    return inFlightCurrentUser;
  }

  inFlightCurrentUser = (async () => {
    try {
      const data = await call<{ user: any }>(() => apiClient.get('/auth/me'), 'Failed to fetch profile');
      return toUser(data.user);
    } finally {
      inFlightCurrentUser = null;
    }
  })();

  return inFlightCurrentUser;
}

// For an already-authenticated user whose onboarding isn't done yet — e.g.
// a Google account created straight from the Login screen, before the
// onboarding wizard ran. Attaches the wizard's answers to that account
// (POST /api/auth/complete-onboarding) instead of creating a new one.
// referralCode: typed in the wizard after a Login-screen Google/Apple
// account was created; attributes the account to that inviter if nobody
// has yet.
export async function completeOnboarding(
  onboarding: OnboardingAnswerPayload[],
  routineTaskIds: string[] = [],
  referralCode?: string
): Promise<User> {
  const data = await call<{ user: any }>(
    () => apiClient.post('/auth/complete-onboarding', { onboarding, ...signupExtras(referralCode, routineTaskIds) }),
    'Could not save your answers'
  );
  return toUser(data.user);
}

const OTP_SENT_MESSAGE = 'Verification code sent to your email. It expires in 10 minutes.';

export async function sendOtp(email: string): Promise<string> {
  try {
    const { data } = await apiClient.post('/auth/send-otp', { email });
    return data?.message || OTP_SENT_MESSAGE;
  } catch (err) {
    throw apiFailure(err);
  }
}

export async function resendOtp(email: string): Promise<string> {
  return sendOtp(email);
}

export async function verifyOtp(email: string, otp: string): Promise<void> {
  await call(() => apiClient.post('/auth/verify-otp', { email, otp }),
    'Invalid or expired verification code. Please request a new one.');
}

export async function forgotPassword(email: string): Promise<string> {
  try {
    const { data } = await apiClient.post('/auth/forgot-password', { email });
    return data?.message ||
      'If an account exists for this email, we have sent instructions to reset your Secret Key. Check your spam folder if it does not arrive within 2 minutes.';
  } catch (err) {
    throw apiFailure(err);
  }
}

/**
 * Signed-in password change. The backend signs out every other device and
 * returns new tokens for this one, which are saved here so it stays signed in.
 * Throws an Error with a message ready to show the user.
 */
export async function changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
  const data = await call<TokenPair>(
    () => apiClient.post('/auth/change-password', { currentPassword, newPassword, confirmPassword }),
    'Could not change your password. Please try again.'
  );
  await saveTokens(data);
}

export async function resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<string> {
  try {
    const { data } = await apiClient.post('/auth/reset-password', { token, newPassword, confirmPassword });
    return data?.message || 'Password reset successfully.';
  } catch (err) {
    throw apiFailure(err);
  }
}

export type UpdateProfilePayload = {
  name?: string;
  gender?: string;
  birthday?: string;
  height?: number;
  weight?: number;
  avatar_id?: number | string;
};

export { refreshAccessToken } from './client';

export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  const data = await call<{ user: any }>(() => apiClient.patch('/auth/profile', payload), 'Failed to update profile');
  return toUser(data.user);
}

export async function updateUserAvatar(avatarId: number | string): Promise<User> {
  const numId = typeof avatarId === 'string' ? parseInt(avatarId, 10) : avatarId;
  const payload = { avatarId: isNaN(numId) ? avatarId : numId };
  const data = await call<{ user: any }>(() => apiClient.patch('/users/me/avatar', payload), 'Failed to update avatar');
  return toUser(data.user);
}

/**
 * Email change, step 1: the backend emails a 6-digit code to the new
 * address. Password accounts must confirm their current password.
 * Returns the server's message to show ("We sent a 6-digit code to …").
 */
export async function requestEmailChange(email: string, currentPassword?: string): Promise<string> {
  try {
    const { data } = await apiClient.patch('/users/me/email', {
      email: email.trim(),
      ...(currentPassword ? { currentPassword } : {}),
    });
    return data?.message || `We sent a 6-digit code to ${email.trim()}.`;
  } catch (err) {
    throw apiFailure(err);
  }
}

/** Email change, step 2: the code from the email switches the address. */
export async function confirmEmailChange(email: string, otp: string): Promise<User> {
  const data = await call<{ user: any }>(
    () => apiClient.patch('/users/me/email', { email: email.trim(), otp: otp.trim() }),
    'Failed to update email'
  );
  return toUser(data.user);
}

/**
 * One-time (10-minute) link to confirm account deletion on the website
 * (POST /account/delete/link). The website schedules the deletion.
 */
export async function createAccountDeletionLink(): Promise<string> {
  const data = await call<{ url: string }>(() => apiClient.post('/account/delete/link'), 'Could not start account deletion.');
  if (!data?.url) throw new Error('Could not start account deletion.');
  return data.url;
}

/** Cancels a pending account deletion (POST /account/delete/cancel). */
export async function cancelAccountDeletion(): Promise<void> {
  await call(() => apiClient.post('/account/delete/cancel'), 'Could not cancel account deletion.');
}
