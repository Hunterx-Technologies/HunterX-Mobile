import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { registerPushDevice, sendTestPush, unregisterPushDevice } from '@/services/api/notifications.service';

/**
 * Push notifications (Expo push service → APNs / FCM). The backend sends;
 * this module owns the device side: permission, Android channels, the
 * Expo push token and registering it with the backend, plus foreground
 * display rules. Every export is a safe no-op on web and simulators.
 *
 * Payload contract from the backend (pushDispatchService.js):
 *   data: { notification_id, type, url, ...event fields }, channelId ∈ CHANNELS
 */

export const isPushSupported = Platform.OS === 'ios' || Platform.OS === 'android';

const PROMPTED_DATE_KEY = 'hunterx.pushPermissionPromptedDate';
const REGISTER_THROTTLE_MS = 30 * 60 * 1000;

// Must match config/notificationTypes.js `channel` values in HunterX-Backend.
const CHANNELS: { id: string; name: string; description: string; importance: Notifications.AndroidImportance }[] = [
  { id: 'reminders', name: 'Quest reminders', description: 'Daily quest reminders and motivation', importance: Notifications.AndroidImportance.HIGH },
  { id: 'streaks', name: 'Streak alerts', description: 'Streak at risk, shields and milestones', importance: Notifications.AndroidImportance.HIGH },
  { id: 'rewards', name: 'Rewards & level ups', description: 'Level ups, rank ups and rewards', importance: Notifications.AndroidImportance.DEFAULT },
  { id: 'social', name: 'Friends & leaderboard', description: 'Friends joining and rank changes', importance: Notifications.AndroidImportance.DEFAULT },
  { id: 'system', name: 'Account & announcements', description: 'Announcements, feedback replies, health sync', importance: Notifications.AndroidImportance.DEFAULT },
];

// Pushes the user caused themselves by acting in the app (completing a
// quest) — they already saw the in-app celebration, so no foreground banner.
// They still land in the notification list and the inbox.
const SILENT_IN_FOREGROUND = new Set(['LEVEL_UP', 'STREAK_MILESTONE', 'REWARD_READY']);

export function configureForegroundHandling() {
  if (!isPushSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const type = notification.request.content.data?.type;
      const showBanner = !(typeof type === 'string' && SILENT_IN_FOREGROUND.has(type));
      return {
        shouldShowBanner: showBanner,
        shouldShowList: true,
        shouldPlaySound: showBanner,
        shouldSetBadge: false,
      };
    },
  });
}

export async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        description: c.description,
        importance: c.importance,
        lightColor: '#FE5B01',
        vibrationPattern: [0, 200, 120, 200],
      })
    )
  );
}

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

function toPushPermission(status: Notifications.NotificationPermissionsStatus): PushPermission {
  if (status.granted) return 'granted';
  if (status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  if (status.status === 'denied') return status.canAskAgain ? 'undetermined' : 'denied';
  return 'undetermined';
}

export async function getPushPermission(): Promise<PushPermission> {
  if (!isPushSupported || !Device.isDevice) return 'unsupported';
  const permission = toPushPermission(await Notifications.getPermissionsAsync());
  // Android: Expo decides "asked before, can't ask again" from a record kept
  // in SharedPreferences, which Android Auto Backup restores after a
  // reinstall while the permission itself starts fresh. That reads as
  // blocked and hid our prompt forever. Our own "prompted" flag lives in
  // AsyncStorage (not backed up), so trust it: never prompted on this
  // install → still ours to ask. If Android really is blocking the dialog,
  // the request returns 'denied' and the caller sends the user to Settings.
  if (permission === 'denied' && Platform.OS === 'android' && !(await hasPromptedForPush())) {
    return 'undetermined';
  }
  return permission;
}

/** Shows the OS prompt. Android 13+ needs a channel to exist first. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!isPushSupported || !Device.isDevice) return 'unsupported';
  await ensureAndroidChannels();
  const result = toPushPermission(await Notifications.requestPermissionsAsync());
  await markPushPrompted();
  return result;
}

export async function hasPromptedForPush(): Promise<boolean> {
  try {
    const lastDate = await AsyncStorage.getItem(PROMPTED_DATE_KEY);
    if (!lastDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    return lastDate === today;
  } catch {
    return false;
  }
}

export async function markPushPrompted(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem(PROMPTED_DATE_KEY, today);
  } catch {}
}

export async function resetPushPrompted(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROMPTED_DATE_KEY);
  } catch {}
}

let currentToken: string | null = null;
let lastRegisteredAt = 0;
let registerInFlight: Promise<string | null> | null = null;
let lastDeviceToken: string | null = null;

/**
 * For Notifications.addPushTokenListener. On Android the listener fires on
 * every token fetch, not only on a real rotation — and registering fetches
 * the token, so re-registering on every event loops forever. True only when
 * the device token actually differs from the one seen before.
 */
export function isDeviceTokenRotation(deviceToken: string): boolean {
  const rotated = lastDeviceToken !== null && lastDeviceToken !== deviceToken;
  lastDeviceToken = deviceToken;
  return rotated;
}

async function getExpoToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/**
 * Registers this device's push token with the backend if permission is
 * granted. Called on sign-in, every app foreground (throttled — it also
 * refreshes the backend's last-seen time used by win-back pushes) and on
 * token rotation (force).
 */
export function registerDeviceIfPermitted({ force = false }: { force?: boolean } = {}): Promise<string | null> {
  // Sign-in, foreground and the permission prompt can overlap: share one call.
  registerInFlight ??= registerDevice(force).finally(() => {
    registerInFlight = null;
  });
  return registerInFlight;
}

async function registerDevice(force: boolean): Promise<string | null> {
  if ((await getPushPermission()) !== 'granted') return null;
  if (!force && currentToken && Date.now() - lastRegisteredAt < REGISTER_THROTTLE_MS) return currentToken;

  await ensureAndroidChannels();
  const token = await getExpoToken();
  if (!token) return null;

  await registerPushDevice({
    token,
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    app_version: Constants.expoConfig?.version,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  currentToken = token;
  lastRegisteredAt = Date.now();
  return token;
}

/** Call BEFORE clearing the session on logout — the DELETE needs auth. */
export async function unregisterDevice(): Promise<void> {
  try {
    const token = currentToken ?? ((await getPushPermission()) === 'granted' ? await getExpoToken() : null);
    if (token) await unregisterPushDevice(token);
  } catch {
    // Best-effort: a stale token gets re-pointed on the next login anyway.
  } finally {
    currentToken = null;
    lastRegisteredAt = 0;
    lastDeviceToken = null;
  }
}

/**
 * Step-by-step push check for test builds (System Settings → Push diagnostics).
 * Runs every stage the real flow runs — permission, Expo token, backend
 * registration, a test send — and reports where it breaks.
 */
export async function runPushDiagnostics(): Promise<string[]> {
  const lines: string[] = [];
  const step = (ok: boolean, text: string) => lines.push(`${ok ? '✅' : '❌'} ${text}`);
  const errText = (err: any) =>
    err?.response?.data?.message || err?.response?.status
      ? `HTTP ${err?.response?.status ?? '?'}: ${err?.response?.data?.message ?? err?.message}`
      : err?.message || String(err);

  if (!isPushSupported || !Device.isDevice) {
    step(false, 'Not a physical Android/iOS device');
    return lines;
  }

  let permission: PushPermission;
  try {
    const raw = await Notifications.getPermissionsAsync();
    permission = toPushPermission(raw);
    if (permission !== 'granted') {
      permission = await requestPushPermission();
    }
    step(permission === 'granted', `Permission: ${permission}`);
  } catch (err) {
    step(false, `Permission check failed: ${errText(err)}`);
    return lines;
  }
  if (permission !== 'granted') return lines;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  step(!!projectId, `EAS projectId: ${projectId ?? 'missing'}`);
  if (!projectId) return lines;

  let token: string;
  try {
    await ensureAndroidChannels();
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    step(true, `Expo token: ${token.slice(0, 32)}…`);
  } catch (err) {
    step(false, `Expo token failed: ${errText(err)}`);
    return lines;
  }

  try {
    await registerPushDevice({
      token,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      app_version: Constants.expoConfig?.version,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    currentToken = token;
    lastRegisteredAt = Date.now();
    step(true, 'Registered with backend');
  } catch (err) {
    step(false, `Backend registration failed: ${errText(err)}`);
    return lines;
  }

  try {
    const result = await sendTestPush();
    step(result.push_status === 'SENT', `Test push: ${result.push_status}${result.push_error ? ` (${result.push_error})` : ''} · devices ${result.devices}`);
  } catch (err) {
    step(false, `Test push failed: ${errText(err)}`);
  }
  return lines;
}

export function setAppBadgeCount(count: number) {
  if (!isPushSupported) return;
  Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => {});
}
