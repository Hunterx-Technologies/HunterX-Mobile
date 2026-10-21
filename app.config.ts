import type { ConfigContext, ExpoConfig } from 'expo/config';

// Everything else lives in app.json — this only layers on the app's link
// host so https://<host>/guestpass/<code> (referrals) and
// https://<host>/reset-password?token=… open the app instead of the browser.
// Keep the fallback in sync with config/env.ts.
// The host must serve /.well-known/apple-app-site-association and
// /.well-known/assetlinks.json (see public/.well-known/).
const REFERRAL_LINK_HOST = process.env.EXPO_PUBLIC_REFERRAL_LINK_HOST || 'join.hunterx.app';

// Standalone test APKs pointed at a dev machine's backend over plain
// http://<LAN-IP> need cleartext traffic, which release builds block.
// Only the `apk-local` EAS profile sets this — never production.
const ALLOW_CLEARTEXT_HTTP = process.env.ALLOW_CLEARTEXT_HTTP === 'true';

type PluginEntry = string | [string, any];

function withCleartextBuildProperty(plugins: PluginEntry[] = []): PluginEntry[] {
  if (!ALLOW_CLEARTEXT_HTTP) return plugins;
  let found = false;
  const next = plugins.map((plugin): PluginEntry => {
    const [name, options = {}] = Array.isArray(plugin) ? plugin : [plugin, {}];
    if (name !== 'expo-build-properties') return plugin;
    found = true;
    return [name, { ...options, android: { ...options.android, usesCleartextTraffic: true } }];
  });
  return found ? next : [...next, ['expo-build-properties', { android: { usesCleartextTraffic: true } }]];
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: withCleartextBuildProperty(config.plugins as PluginEntry[]),
  ios: {
    ...config.ios,
    associatedDomains: [`applinks:${REFERRAL_LINK_HOST}`],
  },
  android: {
    ...config.android,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: REFERRAL_LINK_HOST, pathPrefix: '/guestpass' },
          // Password-reset emails — backend builds them from APP_URL.
          { scheme: 'https', host: REFERRAL_LINK_HOST, pathPrefix: '/reset-password' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
});
