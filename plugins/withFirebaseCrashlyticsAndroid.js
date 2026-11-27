// Firebase Crashlytics for Android only. Used while the project has no
// GoogleService-Info.plist: the stock @react-native-firebase plugins also run
// their iOS steps, and those fail without the plist. This runs just their
// Android steps (Google Services + Crashlytics Gradle plugins, copying
// google-services.json). app.config.ts switches to the stock plugins once the
// plist is added.
const path = require('path');
const { withPlugins } = require('expo/config-plugins');

// The packages' "exports" don't expose these files, so load them by path.
const pluginDir = (pkg) =>
  path.join(path.dirname(require.resolve(`${pkg}/app.plugin.js`)), 'plugin/build/android');
const firebaseAppAndroid = require(pluginDir('@react-native-firebase/app'));
const crashlyticsAndroid = require(pluginDir('@react-native-firebase/crashlytics'));

module.exports = function withFirebaseCrashlyticsAndroid(config) {
  return withPlugins(config, [
    firebaseAppAndroid.withBuildscriptDependency,
    firebaseAppAndroid.withApplyGoogleServicesPlugin,
    firebaseAppAndroid.withCopyAndroidGoogleServices,
    crashlyticsAndroid.withBuildscriptDependency,
    crashlyticsAndroid.withApplyCrashlyticsPlugin,
  ]);
};
