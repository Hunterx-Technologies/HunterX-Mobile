import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Holds the inviter's referral code between opening a Guest Pass link
 * (app/guestpass/[code].tsx) and actually creating the account — the
 * onboarding wizard sits in between, and the app may be killed mid-way.
 * Sent as `referral_code` on register / Google sign-in (useAuthStore);
 * the backend ignores unknown codes, so a stale one is harmless.
 */
const PENDING_REFERRAL_KEY = 'hunterx.pendingReferralCode';

const storage =
  Platform.OS === 'web'
    ? {
        getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
        setItem: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
        deleteItem: async (key: string) => globalThis.localStorage?.removeItem(key),
      }
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        deleteItem: SecureStore.deleteItemAsync,
      };

// Backend codes are 8 uppercase alphanumerics (utils/helpers.js
// generateReferralCode); allow a little slack but reject junk.
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
}

export async function savePendingReferral(raw: string | null | undefined): Promise<void> {
  const code = normalizeReferralCode(raw);
  if (!code) return;
  try {
    await storage.setItem(PENDING_REFERRAL_KEY, code);
  } catch {}
}

export async function getPendingReferral(): Promise<string | null> {
  try {
    return normalizeReferralCode(await storage.getItem(PENDING_REFERRAL_KEY));
  } catch {
    return null;
  }
}

export async function clearPendingReferral(): Promise<void> {
  try {
    await storage.deleteItem(PENDING_REFERRAL_KEY);
  } catch {}
}
