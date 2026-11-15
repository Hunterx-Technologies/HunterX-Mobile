import axios from 'axios';

import { apiClient, refreshAccessToken, setAccountSuspendedHandler, setSessionExpiredHandler } from '../client';
import { tokenStorage } from '../tokenStorage';

jest.mock('../tokenStorage', () => {
  const store: Record<string, string | null> = { access: null, refresh: null };
  return {
    tokenStorage: {
      getAccessToken: jest.fn(async () => store.access),
      getRefreshToken: jest.fn(async () => store.refresh),
      setTokens: jest.fn(async (a: string, r: string) => {
        store.access = a;
        store.refresh = r;
      }),
      clearTokens: jest.fn(async () => {
        store.access = null;
        store.refresh = null;
      }),
    },
  };
});

const httpError = (status: number, code?: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { success: false, ...(code ? { error: { code } } : {}) } },
  });

describe('refreshAccessToken', () => {
  const onExpired = jest.fn();
  let post: jest.SpyInstance;

  beforeEach(async () => {
    await tokenStorage.setTokens('old-access', 'old-refresh');
    onExpired.mockReset();
    setSessionExpiredHandler(onExpired);
    post = jest.spyOn(axios, 'post');
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('stores the rotated pair', async () => {
    post.mockResolvedValue({ data: { success: true, data: { access_token: 'a2', refresh_token: 'r2' } } });
    await expect(refreshAccessToken()).resolves.toBe('a2');
    expect(await tokenStorage.getRefreshToken()).toBe('r2');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatch(/\/auth\/refresh$/);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('signs out when the server refuses the session', async () => {
    post.mockRejectedValue(httpError(404, 'ACCOUNT_NOT_FOUND'));
    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledWith('ACCOUNT_NOT_FOUND');
  });

  it('keeps the session through a network failure', async () => {
    post.mockRejectedValue(new Error('Network Error'));
    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBe('old-refresh');
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('never logs the request body (it holds the refresh token)', async () => {
    post.mockRejectedValue(Object.assign(httpError(401), { config: { data: '{"refreshToken":"old-refresh"}' } }));
    await refreshAccessToken();
    const logged = JSON.stringify((console.warn as jest.Mock).mock.calls);
    expect(logged).not.toContain('old-refresh');
  });
});

describe('a banned account (403 ACCOUNT_SUSPENDED)', () => {
  const onSuspended = jest.fn();
  const onExpired = jest.fn();
  const suspended = (reason: string | null) =>
    Object.assign(new Error('Request failed with status code 403'), {
      response: {
        status: 403,
        data: { success: false, message: 'Your account has been suspended', error: { code: 'ACCOUNT_SUSPENDED', reason } },
      },
    });

  beforeEach(async () => {
    await tokenStorage.setTokens('old-access', 'old-refresh');
    onSuspended.mockReset();
    onExpired.mockReset();
    setAccountSuspendedHandler(onSuspended);
    setSessionExpiredHandler(onExpired);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('signs out with the reason when the session renewal is refused', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(suspended('Cheating on quests'));
    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
    expect(onSuspended).toHaveBeenCalledWith('Cheating on quests');
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('signs out on any ordinary request the server refuses', async () => {
    const adapter = jest.fn(async (config: any) => {
      throw Object.assign(suspended(null), { config, isAxiosError: true });
    });
    await expect(apiClient.get('/tasks/today', { adapter })).rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED', status: 403 });
    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(onSuspended).toHaveBeenCalledWith(null);
  });
});
