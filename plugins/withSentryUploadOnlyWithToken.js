// Skips Sentry's build-time source-map/debug-symbol upload when the build has
// no SENTRY_AUTH_TOKEN, instead of failing the build.
//
// Why not just leave the @sentry/react-native plugin out when the token is
// missing? Because the plugin list is part of the runtime fingerprint
// (expo-updates). SENTRY_AUTH_TOKEN is a *secret* EAS variable: EAS builders
// see it, but `eas update` on a laptop can't. Gating the plugin on it made
// builds and updates compute different runtime versions, so no OTA update
// would ever match a store build. So the plugin is always in the config, and
// the token is checked when Xcode/Gradle run, not when the config is read.
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const MARKER = 'hunterx: skip Sentry upload without token';

// Both Sentry Xcode phases (bundle + debug symbols) source ios/.xcode.env.
// So do Expo's own phases, under `set -e`: the file must end with exit
// status 0. `[ -z … ] && export …` returns 1 when the token IS set, which
// made "[Expo] Configure project" stop silently on EAS production builds,
// so this has to be an if/fi.
const IOS_LINE = `if [ -z "$SENTRY_AUTH_TOKEN" ]; then export SENTRY_DISABLE_AUTO_UPLOAD=true; fi # ${MARKER}`;

// sentry.gradle reads this closure in afterEvaluate, so redefining it at the
// end of app/build.gradle (after sentry.gradle is applied) wins.
const ANDROID_BLOCK = `
// ${MARKER}
if (!System.getenv('SENTRY_AUTH_TOKEN')) {
    project.ext.shouldSentryAutoUploadGeneral = { -> false }
}
`;

const withIos = (config) =>
  withDangerousMod(config, [
    'ios',
    (mod) => {
      const file = path.join(mod.modRequest.platformProjectRoot, '.xcode.env');
      const contents = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      // Drop a line from an earlier version of this plugin, then add the current one.
      const kept = contents.split('\n').filter((line) => !line.includes(MARKER)).join('\n');
      fs.writeFileSync(file, `${kept.replace(/\n*$/, '\n')}\n${IOS_LINE}\n`);
      return mod;
    },
  ]);

const withAndroid = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents += ANDROID_BLOCK;
    }
    return mod;
  });

module.exports = function withSentryUploadOnlyWithToken(config) {
  return withAndroid(withIos(config));
};
