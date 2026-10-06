import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/config/env';
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

export async function refreshAccessToken(): Promise<string | null> {
  const currentRefreshToken = await tokenStorage.getRefreshToken();
  if (!currentRefreshToken) return null;

  try {
    let res;
    try {
      res = await axios.post<ApiResponse<{ accessToken?: string; refreshToken?: string; access_token?: string; refresh_token?: string }>>(
        `${env.apiUrl}/auth/refresh`,
        { refreshToken: currentRefreshToken, refresh_token: currentRefreshToken }
      );
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.message?.includes('404')) {
        res = await axios.post<ApiResponse<{ accessToken?: string; refreshToken?: string; access_token?: string; refresh_token?: string }>>(
          `${env.apiUrl}/api/auth/refresh`,
          { refreshToken: currentRefreshToken, refresh_token: currentRefreshToken }
        );
      } else {
        throw err;
      }
    }

    const resData = res.data;
    if (resData && typeof resData === 'object' && 'success' in resData && resData.success === false) {
      return null;
    }

    const accessToken =
      (resData as any)?.data?.access_token ||
      (resData as any)?.data?.accessToken ||
      (resData as any)?.access_token ||
      (resData as any)?.accessToken;

    const newRefreshToken =
      (resData as any)?.data?.refresh_token ||
      (resData as any)?.data?.refreshToken ||
      (resData as any)?.refresh_token ||
      (resData as any)?.refreshToken ||
      currentRefreshToken;

    if (accessToken) {
      await tokenStorage.setTokens(accessToken, newRefreshToken);
      return accessToken;
    }
    return null;
  } catch (err) {
    console.warn('[refreshAccessToken] Failed to refresh token:', err);
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retried) {
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
