function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    if (__DEV__) {
      console.warn(`[config/env] Missing ${name} — set it in .env (see .env.example)`);
    }
    return '';
  }
  return value;
}

const apiUrl = requireEnv('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL);

// The website matching the API we talk to: production API → production
// site; UAT (and local/LAN backends) → the UAT site. app.config.ts has the
// same rule for the app-link host.
export function websiteHostFor(api: string): string {
  const isProduction = /^https:\/\/api\.hunterx\.co\.in(\/|$)/.test(api);
  return isProduction ? 'www.hunterx.co.in' : 'uat.hunterx.co.in';
}
const websiteHost = websiteHostFor(apiUrl);

export const env = {
  apiUrl,
  // Serves the Terms, Privacy Policy and Delete Account pages.
  websiteUrl: `https://${websiteHost}`,
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
  // Host that serves invite links (https://<host>/invite/<code>) and the
  // .well-known app-link files: the website for this API unless
  // EXPO_PUBLIC_REFERRAL_LINK_HOST overrides it. app.config.ts registers the
  // same host for Universal/App Links.
  referralLinkHost: process.env.EXPO_PUBLIC_REFERRAL_LINK_HOST || websiteHost,
} as const;
