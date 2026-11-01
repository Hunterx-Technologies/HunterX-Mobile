// Production web build: tokens stay in memory and never touch localStorage.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-secure-store', () => ({}));

describe('tokenStorage on a production web build', () => {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: jest.fn((k: string) => store.get(k) ?? null),
    setItem: jest.fn((k: string, v: string) => void store.set(k, v)),
    removeItem: jest.fn((k: string) => void store.delete(k)),
  };

  beforeAll(() => {
    (globalThis as any).__DEV__ = false;
    (globalThis as any).localStorage = localStorageMock;
    store.set('hunterx.refreshToken', 'left-by-an-old-build');
  });

  afterAll(() => {
    (globalThis as any).__DEV__ = true;
    delete (globalThis as any).localStorage;
  });

  it('clears old tokens and keeps new ones out of localStorage', async () => {
    const { tokenStorage } = require('../tokenStorage');
    expect(store.has('hunterx.refreshToken')).toBe(false);

    await tokenStorage.setTokens('access-1', 'refresh-1');
    expect(await tokenStorage.getRefreshToken()).toBe('refresh-1');
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
    expect(store.size).toBe(0);

    await tokenStorage.clearTokens();
    expect(await tokenStorage.getAccessToken()).toBeNull();
  });
});
