// Web build: Firebase Crashlytics is native-only, so everything is a no-op.
// The native implementation is crashlytics.native.ts.
export const crashlyticsAvailable = false;

export const crashlytics = {
  init(_enabled: boolean) {},
  recordError(_error: Error, _name?: string) {},
  log(_message: string) {},
  setUser(_id: string | null, _attributes: Record<string, string> = {}) {},
};
