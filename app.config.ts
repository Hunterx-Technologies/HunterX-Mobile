import type { ConfigContext, ExpoConfig } from 'expo/config';

// Everything else lives in app.json (including scheme "hunterx") — this only
// layers on the app's link host so https://<host>/invite/<code> (invites)
// and https://<host>/reset-password?token=… open the app instead of the
// browser. Same rule as config/env.ts: the production API gets
// www.hunterx.co.in, anything else (UAT, local) uat.hunterx.co.in, unless
// EXPO_PUBLIC_REFERRAL_LINK_HOST overrides it.
// The host must serve /.well-known/apple-app-site-association and
// /.well-known/assetlinks.json — the HunterX-web repo's public/.well-known/.
const IS_PRODUCTION_API = /^https:\/\/api\.hunterx\.co\.in(\/|$)/.test(process.env.EXPO_PUBLIC_API_URL ?? '');
const REFERRAL_LINK_HOST =
  process.env.EXPO_PUBLIC_REFERRAL_LINK_HOST || (IS_PRODUCTION_API ? 'www.hunterx.co.in' : 'uat.hunterx.co.in');

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
          { scheme: 'https', host: REFERRAL_LINK_HOST, pathPrefix: '/invite' },
          // Password-reset emails — backend builds them from APP_URL.
          { scheme: 'https', host: REFERRAL_LINK_HOST, pathPrefix: '/reset-password' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
});
