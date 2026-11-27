import fs from 'fs';
import path from 'path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withEntitlementsPlist } from 'expo/config-plugins';

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

// The `development` EAS profile sets APP_VARIANT=development so the dev-client
// build installs as a separate app ("HunterX Dev", com.hunterx.mobile.dev)
// next to the TestFlight/App Store build instead of replacing it.
// iOS only — Android keeps its package because google-services.json only
// registers com.hunterx.mobile.
const IS_DEV_VARIANT = process.env.APP_VARIANT === 'development';

// Local cable builds (`npx expo run:ios --device`) signed with a free Apple
// Personal Team. Free teams can't sign push, Sign in with Apple or Associated
// Domains, so those entitlements are stripped, and the bundle ID is kept off
// the com.hunterx.* namespace so the paid team can still register it later.
// Never set on EAS.
const LOCAL_FREE_SIGNING = process.env.LOCAL_FREE_SIGNING === 'true';
const LOCAL_FREE_TEAM_ID = process.env.LOCAL_FREE_TEAM_ID || 'DDBW3BH3Y8';
const FREE_TEAM_UNSUPPORTED_ENTITLEMENTS = [
  'aps-environment',
  'com.apple.developer.applesignin',
  'com.apple.developer.associated-domains',
];

// Crash reporting (services/monitoring). Firebase Crashlytics needs a Firebase
// config file per platform: Android's google-services.json is already here;
// iOS gets Crashlytics only once GoogleService-Info.plist is added to the
// project root (Firebase console → Project settings → add iOS app
// com.hunterx.mobile). Until then iOS leaves Firebase out of the build and
// Sentry handles native crashes there. react-native.config.js makes the same
// check to keep the Firebase pods out. With the plist, iOS builds Firebase
// through CocoaPods (disableSPM — RNFirebase 26's SPM route needs dynamic
// frameworks) with static frameworks, which Firebase's Swift pods require.
const IOS_FIREBASE_PLIST = 'GoogleService-Info.plist';
const HAS_IOS_FIREBASE = fs.existsSync(path.join(__dirname, IOS_FIREBASE_PLIST));

function withCrashReportingPlugins(plugins: PluginEntry[]): PluginEntry[] {
  const next: PluginEntry[] = HAS_IOS_FIREBASE
    ? [
        ...plugins.map((plugin): PluginEntry => {
          const [name, options = {}] = Array.isArray(plugin) ? plugin : [plugin, {}];
          if (name !== 'expo-build-properties') return plugin;
          return [name, { ...options, ios: { ...options.ios, useFrameworks: 'static' } }];
        }),
        ['@react-native-firebase/app', { ios: { disableSPM: true } }],
        '@react-native-firebase/crashlytics',
        './plugins/withCrashlyticsIosDsymUpload',
      ]
    : [...plugins, './plugins/withFirebaseCrashlyticsAndroid'];
  // Source-map and debug-symbol upload at build time, so JS stack traces in
  // Sentry show real file names and lines. Needs SENTRY_AUTH_TOKEN (a secret
  // EAS environment variable); without it the upload is skipped at build time
  // and builds still work, just with minified stack traces. The plugin is
  // always listed — never gate config on a secret: `eas update` can't read
  // secrets, and a different plugin list means a different runtime
  // fingerprint, so OTA updates would never match the store build.
  next.push(
    [
      '@sentry/react-native',
      {
        organization: process.env.SENTRY_ORG || 'hunterx-ltd',
        project: process.env.SENTRY_PROJECT || 'hunterx-mobile',
      },
    ],
    './plugins/withSentryUploadOnlyWithToken',
  );
  return next;
}

const withoutFreeTeamUnsupportedEntitlements = (cfg: ExpoConfig): ExpoConfig =>
  withEntitlementsPlist(cfg, (mod) => {
    for (const key of FREE_TEAM_UNSUPPORTED_ENTITLEMENTS) delete mod.modResults[key];
    return mod;
  });

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  ...(IS_DEV_VARIANT && { name: 'HunterX Dev', scheme: 'hunterx-dev' }),
  // Mods for the same file run in reverse order, so the stripper goes first
  // to run after the plugins that add those entitlements.
  plugins: [
    ...(LOCAL_FREE_SIGNING ? [withoutFreeTeamUnsupportedEntitlements] : []),
    ...withCrashReportingPlugins(withCleartextBuildProperty(config.plugins as PluginEntry[])),
  ] as ExpoConfig['plugins'],
  extra: {
    ...config.extra,
    // Read by services/monitoring/crashlytics.native.ts.
    crashlyticsIos: HAS_IOS_FIREBASE,
  },
  ios: {
    ...config.ios,
    ...(HAS_IOS_FIREBASE && { googleServicesFile: `./${IOS_FIREBASE_PLIST}` }),
    ...(IS_DEV_VARIANT && { bundleIdentifier: 'com.hunterx.mobile.dev' }),
    ...(LOCAL_FREE_SIGNING && {
      bundleIdentifier: 'com.shakthi.hunterx.dev',
      appleTeamId: LOCAL_FREE_TEAM_ID,
      usesAppleSignIn: false,
    }),
    associatedDomains: LOCAL_FREE_SIGNING ? [] : [`applinks:${REFERRAL_LINK_HOST}`],
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
