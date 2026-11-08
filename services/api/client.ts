import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/config/env';
import { markOffline, markOnline } from '@/store/useConnectivityStore';
import type { ApiResponse } from '@/types/api';

import { tokenStorage } from './tokenStorage';

export class ApiError extends Error {
  code: string;
  status?: number;
  response?: any;

  constructor(code: string, message: string, status?: number, response?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.response = response;
  }
}

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
});

if (__DEV__) {
  apiClient.interceptors.request.use((config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL || ''}${config.url}`, config.data || '');
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => {
      console.log(`[API Response Success] ${response.config.method?.toUpperCase()} ${response.config.url}`, response.status, response.data);
      return response;
    },
    (error) => {
      console.log(
        `[API Response Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        error.response?.status || 'Network/Timeout',
        error.response?.data || error.message
      );
      return Promise.reject(error);
    }
  );
}

apiClient.interceptors.request.use(async (config) => {
  const accessToken = await tokenStorage.getAccessToken();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

const NETWORK_RETRY_DELAY_MS = 700;

const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout'];

// Called when the session is definitely over — the refresh token was
// refused (expired, revoked, account deleted or suspended) — so the app can
// sign out instead of failing every request. Registered by useAuthStore;
// kept as a callback so this module doesn't import the store.
let sessionExpiredHandler: ((code: string | null) => void) | null = null;

export function setSessionExpiredHandler(handler: ((code: string | null) => void) | null) {
  sessionExpiredHandler = handler;
}

export async function refreshAccessToken(): Promise<string | null> {
  const currentRefreshToken = await tokenStorage.getRefreshToken();
  if (!currentRefreshToken) return null;

  try {
    const res = await axios.post<ApiResponse<{ access_token?: string; refresh_token?: string }>>(
      `${env.apiUrl}/auth/refresh`,
      { refreshToken: currentRefreshToken },
      { timeout: 15000 }
    );
    const data = res.data && res.data.success ? res.data.data : null;
    if (!data?.access_token) return null;

    await tokenStorage.setTokens(data.access_token, data.refresh_token || currentRefreshToken);
    return data.access_token;
  } catch (err: any) {
    const status: number | undefined = err?.response?.status;
    // 400/401/403/404 = the server refused this session for good. Anything
    // else (offline, timeout, 5xx) may pass, so the tokens are kept.
    if (status && [400, 401, 403, 404].includes(status)) {
      await tokenStorage.clearTokens();
      sessionExpiredHandler?.(err?.response?.data?.error?.code ?? null);
    }
    // Status only — the error object carries the request body, which holds
    // the refresh token.
    console.warn('[refreshAccessToken] Failed to refresh token:', status ?? err?.message ?? 'unknown error');
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => {
    markOnline();
    return response;
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean; _networkRetried?: boolean })
      | undefined;

    // A read that failed before reaching the server (a dropped connection,
    // not a timeout) is tried once more after a short pause, so a brief blip
    // doesn't surface as an error. Writes are never repeated automatically.
    if (
      !error.response &&
      !axios.isCancel(error) &&
      error.code !== 'ECONNABORTED' &&
      error.code !== 'ETIMEDOUT' &&
      originalRequest &&
      (originalRequest.method ?? 'get').toLowerCase() === 'get' &&
      !originalRequest._networkRetried
    ) {
      originalRequest._networkRetried = true;
      await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS));
      return apiClient(originalRequest);
    }

    // No response at all = no internet (or it timed out): show the offline
    // pop-up. Any response, even an error status, means we're online.
    if (error.response) markOnline();
    else if (!axios.isCancel(error)) markOffline();

    // A 401 that means "wrong password", not "expired token", is passed
    // straight through — refreshing wouldn't change it.
    const isCredentialCheck =
      NO_REFRESH_URLS.includes(originalRequest?.url ?? '') ||
      (error.response?.data as any)?.error?.code === 'INVALID_CURRENT_PASSWORD';

    if (error.response?.status === 401 && originalRequest && !originalRequest._retried && !isCredentialCheck) {
      originalRequest._retried = true;

      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccessToken = await refreshPromise;

      if (newAccessToken) {
        originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      }
    }

    const body = error.response?.data;
    if (body) {
      if (typeof body === 'string') {
        throw new ApiError('api_error', body, error.response?.status, error.response);
      }
      if (typeof body === 'object') {
        const msg = (body as any).message || (body as any).error?.message || (body as any).error;
        if (msg && typeof msg === 'string') {
          throw new ApiError((body as any).error?.code || 'api_error', msg, error.response?.status, error.response);
        }
      }
    }
    throw new ApiError('network_error', error.message, error.response?.status, error.response);
  }
);
