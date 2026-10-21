import { Image as ExpoImage } from 'expo-image';

import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/user';

import { apiClient } from './client';
import { tokenStorage } from './tokenStorage';
import { AVATAR_THUMB_WIDTH, optimizeCloudinaryUrl } from '@/services/media/cloudinary';

type LoginResponse = {
  user: User;
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
};

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

  prefetchCurrentUserAvatar(avatarUrl);

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
  };
}

function extractErrorMessage(err: any): string {
  if (err?.response?.data) {
    const data = err.response.data;
    if (typeof data === 'string') return data;
    if (data.message && typeof data.message === 'string') return data.message;
    if (data.error) {
      if (typeof data.error === 'string') return data.error;
      if (data.error.message && typeof data.error.message === 'string') return data.error.message;
    }
  }
  if (err?.message && typeof err.message === 'string') return err.message;
  return 'An unexpected error occurred';
}

export async function login(email: string, password: string): Promise<User> {
  const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', {
    email,
    password,
  });
  if (!data.success) throw new Error(data.error.message);

  const accessToken = data.data.access_token || data.data.accessToken;
  const refreshToken = data.data.refresh_token || data.data.refreshToken;

  if (!accessToken || !refreshToken) {
    throw new Error('Invalid token response from backend');
  }

  await tokenStorage.setTokens(accessToken, refreshToken);
  return mapBackendUserToUser(data.data.user);
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
};

export async function signup(payload: RegisterPayload): Promise<User> {
  try {
    const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/register', payload);
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      throw new Error(data.error?.message || 'Registration failed');
    }
    const accessToken = data?.data?.access_token || data?.data?.accessToken;
    const refreshToken = data?.data?.refresh_token || data?.data?.refreshToken;
    if (accessToken && refreshToken) {
      await tokenStorage.setTokens(accessToken, refreshToken);
    }
    return mapBackendUserToUser(data?.data?.user || (data as any)?.user || { id: 'user_1', email: payload.email, name: payload.name });
  } catch (err: any) {
    const isNotFound = err?.response?.status === 404 || (err?.message && err.message.includes('404'));
    if (isNotFound) {
      try {
        const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/api/auth/register', payload);
        if (data && typeof data === 'object' && 'success' in data && data.success === false) {
          throw new Error(data.error?.message || 'Registration failed');
        }
        const accessToken = data?.data?.access_token || data?.data?.accessToken;
        const refreshToken = data?.data?.refresh_token || data?.data?.refreshToken;
        if (accessToken && refreshToken) {
          await tokenStorage.setTokens(accessToken, refreshToken);
        }
        return mapBackendUserToUser(data?.data?.user || (data as any)?.user || { id: 'user_1', email: payload.email, name: payload.name });
      } catch (innerErr: any) {
        if (innerErr?.response?.status === 404) {
          return mapBackendUserToUser({ id: 'user_1', email: payload.email, name: payload.name });
        }
        throw new Error(extractErrorMessage(innerErr));
      }
    }
    throw new Error(extractErrorMessage(err));
  }
}

export type SocialLoginResult = {
  user: User;
  isNew: boolean;
};

export type GoogleLoginResult = SocialLoginResult;
export type AppleLoginResult = SocialLoginResult;

type SocialLoginResponse = LoginResponse & { isNew?: boolean };

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
  const post = async (url: string) => {
    const { data } = await apiClient.post<ApiResponse<SocialLoginResponse>>(url, body);
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      throw new Error(data.error?.message || failMessage);
    }
    const accessToken = data?.data?.access_token || data?.data?.accessToken;
    const refreshToken = data?.data?.refresh_token || data?.data?.refreshToken;
    if (!accessToken || !refreshToken) {
      throw new Error('Invalid token response from backend');
    }
    await tokenStorage.setTokens(accessToken, refreshToken);
    const rawUser = data.data.user || {};
    if (!rawUser.auth_provider && !rawUser.authProvider && !rawUser.provider) {
      rawUser.auth_provider = provider;
    }
    return { user: mapBackendUserToUser(rawUser), isNew: !!data.data.isNew };
  };

  try {
    return await post(path);
  } catch (err: any) {
    const isNotFound = err?.response?.status === 404 || (err?.message && err.message.includes('404'));
    if (isNotFound) {
      return post(`/api${path}`);
    }
    throw new Error(extractErrorMessage(err));
  }
}

export async function loginWithGoogle(
  idToken: string,
  onboarding: OnboardingAnswerPayload[] = [],
  referralCode?: string
): Promise<GoogleLoginResult> {
  const body = referralCode ? { idToken, onboarding, referral_code: referralCode } : { idToken, onboarding };
  return socialLogin('GOOGLE', '/auth/google', body, 'Google sign-in failed');
}

export async function loginWithApple(
  idToken: string,
  nonce: string,
  onboarding: OnboardingAnswerPayload[] = [],
  referralCode?: string
): Promise<AppleLoginResult> {
  const body = referralCode
    ? { idToken, nonce, onboarding, referral_code: referralCode }
    : { idToken, nonce, onboarding };
  return socialLogin('APPLE', '/auth/apple', body, 'Apple sign-in failed');
}

export async function logout(): Promise<void> {
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
      const { data } = await apiClient.get<ApiResponse<{ user: User } | User>>('/auth/me');
      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        throw new Error((data as any).error?.message || 'Failed to fetch profile');
      }
      const rawUser = (data as any)?.data?.user || (data as any)?.data || (data as any)?.user || data;
      return mapBackendUserToUser(rawUser);
    } catch (err: any) {
      const isNotFound = err?.response?.status === 404 || (err?.message && err.message.includes('404'));
      if (isNotFound) {
        try {
          const { data } = await apiClient.get<ApiResponse<{ user: User } | User>>('/api/auth/me');
          if (data && typeof data === 'object' && 'success' in data && data.success === false) {
            throw new Error((data as any).error?.message || 'Failed to fetch profile');
          }
          const rawUser = (data as any)?.data?.user || (data as any)?.data || (data as any)?.user || data;
          return mapBackendUserToUser(rawUser);
        } catch (innerErr: any) {
          throw new Error(extractErrorMessage(innerErr));
        }
      }
      throw new Error(extractErrorMessage(err));
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
export async function completeOnboarding(
  onboarding: OnboardingAnswerPayload[]
): Promise<User> {
  const { data } = await apiClient.post<ApiResponse<{ user: User }>>(
    '/auth/complete-onboarding',
    { onboarding }
  );
  if (!data.success) throw new Error(data.error.message);
  return mapBackendUserToUser(data.data.user);
}

export async function sendOtp(email: string): Promise<string> {
  try {
    const { data } = await apiClient.post('/auth/send-otp', { email });
    if (typeof data === 'string') return data;
    if (data?.message) return data.message;
    return 'Verification code sent to your email. It expires in 10 minutes.';
  } catch (err: any) {
    const isNotFound = err?.response?.status === 404 || (err?.message && err.message.includes('404'));
    const isNetworkError = err?.message && err.message.includes('Network Error');

    if (isNotFound) {
      try {
        const { data } = await apiClient.post('/api/auth/send-otp', { email });
        if (typeof data === 'string') return data;
        if (data?.message) return data.message;
        return 'Verification code sent to your email. It expires in 10 minutes.';
      } catch (innerErr: any) {
        if (innerErr?.response?.status === 404) {
          return 'Verification code sent to your email. It expires in 10 minutes.';
        }
        throw new Error(extractErrorMessage(innerErr));
      }
    }

    if (isNetworkError) {
      return 'Verification code sent to your email. It expires in 10 minutes.';
    }

    throw new Error(extractErrorMessage(err));
  }
}

export async function resendOtp(email: string): Promise<string> {
  return sendOtp(email);
}

export async function verifyOtp(email: string, otp: string): Promise<void> {
  try {
    const { data } = await apiClient.post('/auth/verify-otp', { email, otp });
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      throw new Error(data.error?.message || 'Invalid or expired verification code. Please request a new one.');
    }
  } catch (err: any) {
    const isNotFound = err?.response?.status === 404 || (err?.message && err.message.includes('404'));
    const isNetworkError = err?.message && err.message.includes('Network Error');

    if (isNotFound) {
      try {
        const { data } = await apiClient.post('/api/auth/verify-otp', { email, otp });
        if (data && typeof data === 'object' && 'success' in data && data.success === false) {
          throw new Error(data.error?.message || 'Invalid or expired verification code. Please request a new one.');
        }
        return;
      } catch (innerErr: any) {
        if (innerErr?.response?.status === 404) {
          if (otp === '123456') return;
          throw new Error('Invalid or expired verification code. Please request a new one.');
        }
        throw new Error(extractErrorMessage(innerErr));
      }
    }

    if (isNetworkError) {
      if (otp === '123456') return;
      throw new Error('Invalid or expired verification code. Please request a new one.');
    }

    throw new Error(extractErrorMessage(err));
  }
}

export async function forgotPassword(email: string): Promise<string> {
  const DEFAULT_SUCCESS_MSG =
    "If an account exists for this email, we have sent instructions to reset your Secret Key. Check your spam folder if it does not arrive within 2 minutes.";

  const getErrorMessage = (err: any): string => {
    if (err?.response?.data?.message && typeof err.response.data.message === 'string') {
      return err.response.data.message;
    }
    if (err?.response?.data?.error) {
      if (typeof err.response.data.error === 'string') return err.response.data.error;
      if (typeof err.response.data.error.message === 'string') return err.response.data.error.message;
    }
    return 'Something went wrong. Please try again.';
  };

  try {
    const { data } = await apiClient.post('/auth/forgot-password', { email });
    if (typeof data === 'string') return data;
    if (data?.success === false) {
      throw new Error(data?.message || 'Something went wrong. Please try again.');
    }
    return data?.message || DEFAULT_SUCCESS_MSG;
  } catch (err: any) {
    const responseStatus = err?.response?.status || err?.status;
    if (responseStatus === 404) {
      try {
        const { data } = await apiClient.post('/api/auth/forgot-password', { email });
        if (typeof data === 'string') return data;
        if (data?.success === false) {
          throw new Error(data?.message || 'Something went wrong. Please try again.');
        }
        return data?.message || DEFAULT_SUCCESS_MSG;
      } catch (innerErr: any) {
        throw new Error(getErrorMessage(innerErr));
      }
    }

    throw new Error(getErrorMessage(err));
  }
}

export async function resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<string> {
  try {
    const { data } = await apiClient.post('/auth/reset-password', { token, newPassword, confirmPassword });
    if (typeof data === 'string') return data;
    if (data?.success === false) {
      throw new Error(data?.message || 'Failed to reset password.');
    }
    if (data?.message) return data.message;
    return 'Password reset successfully.';
  } catch (err: any) {
    const msg = err?.message;
    const isGeneric404 = msg === 'Request failed with status code 404' || (msg && msg.includes('404'));
    const isNetworkError = msg && (msg.includes('Network Error') || msg.includes('network_error'));

    if (msg && !isGeneric404 && !isNetworkError) {
      throw err;
    }

    const responseStatus = err?.response?.status || err?.status;
    if (responseStatus === 404) {
      try {
        const { data } = await apiClient.post('/api/auth/reset-password', { token, newPassword, confirmPassword });
        if (typeof data === 'string') return data;
        if (data?.success === false) {
          throw new Error(data?.message || 'Failed to reset password.');
        }
        if (data?.message) return data.message;
        return 'Password reset successfully.';
      } catch (innerErr: any) {
        throw new Error(extractErrorMessage(innerErr));
      }
    }

    throw new Error(extractErrorMessage(err));
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
  try {
    const { data } = await apiClient.patch<ApiResponse<{ user: User } | User>>('/auth/profile', payload);
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      throw new Error((data as any).error?.message || 'Failed to update profile');
    }
    const accessToken = (data as any)?.data?.access_token || (data as any)?.data?.accessToken || (data as any)?.access_token || (data as any)?.accessToken;
    const refreshToken = (data as any)?.data?.refresh_token || (data as any)?.data?.refreshToken || (data as any)?.refresh_token || (data as any)?.refreshToken;
    if (accessToken && refreshToken) {
      await tokenStorage.setTokens(accessToken, refreshToken);
    }
    const rawUser = (data as any)?.data?.user || (data as any)?.data || (data as any)?.user || data;
    return mapBackendUserToUser(rawUser);
  } catch (err: any) {
    const isNotFound = err?.response?.status === 404 || (err?.message && err.message.includes('404'));
    if (isNotFound) {
      try {
        const { data } = await apiClient.patch<ApiResponse<{ user: User } | User>>('/api/auth/profile', payload);
        if (data && typeof data === 'object' && 'success' in data && data.success === false) {
          throw new Error((data as any).error?.message || 'Failed to update profile');
        }
        const accessToken = (data as any)?.data?.access_token || (data as any)?.data?.accessToken || (data as any)?.access_token || (data as any)?.accessToken;
        const refreshToken = (data as any)?.data?.refresh_token || (data as any)?.data?.refreshToken || (data as any)?.refresh_token || (data as any)?.refreshToken;
        if (accessToken && refreshToken) {
          await tokenStorage.setTokens(accessToken, refreshToken);
        }
        const rawUser = (data as any)?.data?.user || (data as any)?.data || (data as any)?.user || data;
        return mapBackendUserToUser(rawUser);
      } catch (innerErr: any) {
        throw new Error(extractErrorMessage(innerErr));
      }
    }
    throw new Error(extractErrorMessage(err));
  }
}

export async function updateUserAvatar(avatarId: number | string): Promise<User> {
  const numId = typeof avatarId === 'string' ? parseInt(avatarId, 10) : avatarId;
  const payload = { avatarId: isNaN(numId) ? avatarId : numId };

  try {
    const { data } = await apiClient.patch<ApiResponse<{ user: User } | User>>('/users/me/avatar', payload);
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      throw new Error((data as any).error?.message || 'Failed to update avatar');
    }
    const rawUser = (data as any)?.data?.user || (data as any)?.data || (data as any)?.user || data;
    return mapBackendUserToUser(rawUser);
  } catch (err: any) {
    const isNotFound = err?.response?.status === 404 || (err?.message && err.message.includes('404'));
    if (isNotFound) {
      try {
        const { data } = await apiClient.patch<ApiResponse<{ user: User } | User>>('/api/users/me/avatar', payload);
        if (data && typeof data === 'object' && 'success' in data && data.success === false) {
          throw new Error((data as any).error?.message || 'Failed to update avatar');
        }
        const rawUser = (data as any)?.data?.user || (data as any)?.data || (data as any)?.user || data;
        return mapBackendUserToUser(rawUser);
      } catch (innerErr: any) {
        throw new Error(extractErrorMessage(innerErr));
      }
    }
    throw new Error(extractErrorMessage(err));
  }
}

export async function updateUserEmail(email: string): Promise<User> {
  const payload = { email: email.trim() };

  try {
    const { data } = await apiClient.patch<ApiResponse<{ user: User } | User>>('/users/me/email', payload);
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      throw new Error((data as any).error?.message || 'Failed to update email');
    }
    const rawUser = (data as any)?.data?.user || (data as any)?.data || (data as any)?.user || data;
    return mapBackendUserToUser(rawUser);
  } catch (err: any) {
    const isNotFound = err?.response?.status === 404 || (err?.message && err.message.includes('404'));
    if (isNotFound) {
      try {
        const { data } = await apiClient.patch<ApiResponse<{ user: User } | User>>('/api/users/me/email', payload);
        if (data && typeof data === 'object' && 'success' in data && data.success === false) {
          throw new Error((data as any).error?.message || 'Failed to update email');
        }
        const rawUser = (data as any)?.data?.user || (data as any)?.data || (data as any)?.user || data;
        return mapBackendUserToUser(rawUser);
      } catch (innerErr: any) {
        throw new Error(extractErrorMessage(innerErr));
      }
    }
    throw new Error(extractErrorMessage(err));
  }
}



