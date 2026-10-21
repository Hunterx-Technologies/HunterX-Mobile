function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    if (__DEV__) {
      console.warn(`[config/env] Missing ${name} — set it in .env (see .env.example)`);
    }
    return '';
  }
  return value;
}

export const env = {
  apiUrl: requireEnv('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  // Web client ID doubles as the audience Google issues the ID token for on
  // BOTH platforms — the backend verifies against it. iOS client ID overrides
  // the one GoogleService-Info.plist would normally provide (we don't ship one).
  googleClientIdWeb: requireEnv(
    'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB',
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB
  ),
  googleClientIdIos: requireEnv(
    'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS',
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
  ),
  // Host that serves Guest Pass links (https://<host>/guestpass/<code>) and
  // the .well-known app-link files. Keep the fallback in sync with
  // app.config.ts, which registers the same host for Universal/App Links.
  referralLinkHost: process.env.EXPO_PUBLIC_REFERRAL_LINK_HOST || 'join.hunterx.app',
} as const;
