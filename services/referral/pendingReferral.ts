import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';

/**
 * Holds the inviter's code between opening an invite link
 * (app/invite/[code].tsx), or installing from one on Android, and actually
 * creating the account — the onboarding wizard sits in between, and the app
 * may be killed mid-way. Kept for 7 days. Sent as `referral_code` on
 * register / Google / Apple sign-up (useAuthStore); the backend ignores
 * unknown codes, so a stale one is harmless.
 */
const PENDING_REFERRAL_KEY = 'hunterx.pendingReferralCode';
const INSTALL_REFERRER_CHECKED_KEY = 'hunterx.installReferrerChecked';
const PENDING_REFERRAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

type StoredReferral = { code: string; savedAt: number };

// Same rule as the backend's normalizeReferralCode (utils/helpers.js):
// 6-8 uppercase alphanumerics. New codes skip 0/O/1/I, but older ones may
// still contain them, so those are accepted.
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{6,8}$/.test(code) ? code : null;
}

/**
 * A code from pasted text: either the bare code or an invite link
 * (https://www.hunterx.co.in/invite/<code>, hunterx://invite/<code>, or the
 * older /guestpass/<code>).
 */
export function extractReferralCode(text: string | null | undefined): string | null {
  const trimmed = (text ?? '').trim();
  const fromLink = trimmed.match(/\/(?:invite|guestpass)\/([A-Za-z0-9]+)/);
  return normalizeReferralCode(fromLink ? fromLink[1] : trimmed);
}

/** `ref` from a Play install referrer such as "utm_source=x&ref=AX7KPQ2M". */
export function parseInstallReferrer(referrer: string | null | undefined): string | null {
  for (const pair of (referrer ?? '').split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key !== 'ref') continue;
    try {
      return normalizeReferralCode(decodeURIComponent(value));
    } catch {
      return null;
    }
  }
  return null;
}

export async function savePendingReferral(raw: string | null | undefined): Promise<void> {
  const code = normalizeReferralCode(raw);
  if (!code) return;
  const value: StoredReferral = { code, savedAt: Date.now() };
  try {
    await storage.setItem(PENDING_REFERRAL_KEY, JSON.stringify(value));
  } catch {}
}

export async function getPendingReferral(): Promise<string | null> {
  let raw: string | null;
  try {
    raw = await storage.getItem(PENDING_REFERRAL_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let stored: StoredReferral;
  try {
    stored = JSON.parse(raw);
  } catch {
    // Saved by an older build as the bare code, with no timestamp.
    return normalizeReferralCode(raw);
  }
  if (typeof stored?.savedAt !== 'number' || Date.now() - stored.savedAt > PENDING_REFERRAL_TTL_MS) {
    await clearPendingReferral();
    return null;
  }
  return normalizeReferralCode(stored.code);
}

export async function clearPendingReferral(): Promise<void> {
  try {
    await storage.deleteItem(PENDING_REFERRAL_KEY);
  } catch {}
}

/**
 * Android only, once per install: if the app was installed from a Play
 * link carrying `referrer=ref%3D<code>`, keep that code for sign-up. An
 * invite link opened later still wins, since it saves over this.
 */
export async function captureInstallReferrer(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    if (await storage.getItem(INSTALL_REFERRER_CHECKED_KEY)) return;
    await storage.setItem(INSTALL_REFERRER_CHECKED_KEY, '1');
    const code = parseInstallReferrer(await Application.getInstallReferrerAsync());
    if (code && !(await getPendingReferral())) await savePendingReferral(code);
  } catch {}
}
