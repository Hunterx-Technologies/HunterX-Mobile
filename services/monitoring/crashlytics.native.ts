import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Firebase Crashlytics, wrapped so a missing or broken native module can never
// take the app down with it. Android always ships Firebase (google-services.json).
// iOS ships it only when GoogleService-Info.plist was in the project at build
// time — app.config.ts sets extra.crashlyticsIos to say so.
export const crashlyticsAvailable =
  Platform.OS === 'android' || Constants.expoConfig?.extra?.crashlyticsIos === true;

type CrashlyticsModule = typeof import('@react-native-firebase/crashlytics');

let mod: CrashlyticsModule | null = null;
let instance: ReturnType<CrashlyticsModule['getCrashlytics']> | null = null;

function get() {
  if (!crashlyticsAvailable) return null;
  if (instance) return instance;
  try {
    // Loaded lazily, inside try: on a build without Firebase, importing it at
    // the top would throw before anything could catch it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@react-native-firebase/crashlytics') as CrashlyticsModule;
    instance = mod.getCrashlytics();
    return instance;
  } catch {
    return null;
  }
}

export const crashlytics = {
  init(enabled: boolean) {
    const c = get();
    if (c && mod) mod.setCrashlyticsCollectionEnabled(c, enabled).catch(() => {});
  },
  recordError(error: Error, name?: string) {
    const c = get();
    try {
      if (c && mod) mod.recordError(c, error, name);
    } catch {}
  },
  log(message: string) {
    const c = get();
    try {
      if (c && mod) mod.log(c, message);
    } catch {}
  },
  setUser(id: string | null, attributes: Record<string, string> = {}) {
    const c = get();
    if (!c || !mod) return;
    mod.setUserId(c, id ?? '').catch(() => {});
    if (Object.keys(attributes).length) mod.setAttributes(c, attributes).catch(() => {});
  },
};
