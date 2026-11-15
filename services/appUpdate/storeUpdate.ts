import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';

import { PlayAppUpdate } from '@/modules/app-update';

// The store build's ID on both platforms. Dev builds (com.hunterx.mobile.dev,
// free-team builds) aren't in any store, so they're never blocked.
const STORE_APP_ID = 'com.hunterx.mobile';
const APP_STORE_ID = '6831613229';
// HunterX is listed on the Indian App Store; the lookup is per country.
const APP_STORE_COUNTRY = 'in';

/** Compares dotted versions numerically ("1.10.0" > "1.9.2"). */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = candidate.split('.').map((n) => parseInt(n, 10) || 0);
  const b = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

async function iosStoreHasUpdate(): Promise<boolean> {
  const current = Application.nativeApplicationVersion;
  if (!current) return false;
  // Timestamp defeats the lookup CDN, which can serve an old version for hours.
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=${APP_STORE_COUNTRY}&_=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return false;
  const json = await res.json();
  const listing = json?.results?.[0];
  if (typeof listing?.version !== 'string') return false;
  // Never block a phone that can't install the new version: it would be
  // locked out for good.
  const minOs = listing.minimumOsVersion;
  if (typeof minOs === 'string' && isNewerVersion(minOs, String(Platform.Version))) return false;
  return isNewerVersion(listing.version, current);
}

async function playStoreHasUpdate(): Promise<boolean> {
  if (!PlayAppUpdate) return false;
  const info = await PlayAppUpdate.checkForUpdate();
  // Play only offers an update the phone can install; immediateAllowed is
  // false only in odd states (e.g. not enough storage), where the store page
  // is still the way out.
  return info.updateAvailable;
}

/**
 * True when the store has a newer HunterX than this one. Any failure
 * (offline, sideloaded APK, store hiccup) counts as "no update": a broken
 * check must never lock people out.
 */
export async function isStoreUpdateAvailable(): Promise<boolean> {
  if (__DEV__ || Application.applicationId !== STORE_APP_ID) return false;
  try {
    if (Platform.OS === 'ios') return await iosStoreHasUpdate();
    if (Platform.OS === 'android') return await playStoreHasUpdate();
  } catch (error) {
    console.warn('[appUpdate] store check failed:', error instanceof Error ? error.message : error);
  }
  return false;
}

/**
 * Starts the update. Android: Play's full-screen update page, which installs
 * and restarts the app; falls back to the Play listing. iOS: the App Store page.
 */
export async function startStoreUpdate(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      if (PlayAppUpdate && (await PlayAppUpdate.startImmediateUpdate())) return;
    } catch (error) {
      console.warn('[appUpdate] Play update flow failed:', error instanceof Error ? error.message : error);
    }
    await Linking.openURL(`market://details?id=${STORE_APP_ID}`).catch(() =>
      Linking.openURL(`https://play.google.com/store/apps/details?id=${STORE_APP_ID}`)
    );
    return;
  }
  await Linking.openURL(`itms-apps://apps.apple.com/app/id${APP_STORE_ID}`).catch(() =>
    Linking.openURL(`https://apps.apple.com/app/id${APP_STORE_ID}`)
  );
}
