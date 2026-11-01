import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Backend-issued JWT/refresh token pair only — small strings, safe for
 * SecureStore's per-key size limit.
 *
 * expo-secure-store has no web implementation. A browser has no
 * Keychain/Keystore equivalent, and anything in localStorage can be read
 * by any script on the page, so a production web build keeps the tokens
 * in memory only: signing in again after a reload is the price of never
 * leaving them in browser storage. The web build isn't shipped to users —
 * HunterX ships on iOS/Android — so this only guards against it being
 * hosted by accident. Development web builds (`expo start --web`) still
 * use localStorage so a reload doesn't sign the developer out.
 */
const ACCESS_TOKEN_KEY = 'hunterx.accessToken';
const REFRESH_TOKEN_KEY = 'hunterx.refreshToken';

const devWebStorage = {
  async getItem(key: string) {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string) {
    globalThis.localStorage?.setItem(key, value);
  },
  async deleteItem(key: string) {
    globalThis.localStorage?.removeItem(key);
  },
};

const memory = new Map<string, string>();
const memoryStorage = {
  async getItem(key: string) {
    return memory.get(key) ?? null;
  },
  async setItem(key: string, value: string) {
    memory.set(key, value);
  },
  async deleteItem(key: string) {
    memory.delete(key);
  },
};

// Tokens an older web build may have left in localStorage.
if (Platform.OS === 'web' && !__DEV__) {
  try {
    globalThis.localStorage?.removeItem(ACCESS_TOKEN_KEY);
    globalThis.localStorage?.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
}

const nativeStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  deleteItem: SecureStore.deleteItemAsync,
};

const storage = Platform.OS !== 'web' ? nativeStorage : __DEV__ ? devWebStorage : memoryStorage;

export const tokenStorage = {
  async getAccessToken() {
    return storage.getItem(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return storage.getItem(REFRESH_TOKEN_KEY);
  },
  async setTokens(accessToken: string, refreshToken: string) {
    await storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  async clearTokens() {
    await storage.deleteItem(ACCESS_TOKEN_KEY);
    await storage.deleteItem(REFRESH_TOKEN_KEY);
  },
};
