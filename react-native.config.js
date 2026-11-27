/* global __dirname */
const fs = require('fs');
const path = require('path');

// Keeps the Firebase pods out of the iOS build until GoogleService-Info.plist
// is added — without it Firebase can't start on iOS, and its pods would force
// the whole app onto static frameworks for nothing. Same check as
// app.config.ts (HAS_IOS_FIREBASE). Android always links Firebase.
const HAS_IOS_FIREBASE = fs.existsSync(path.join(__dirname, 'GoogleService-Info.plist'));

const androidOnly = { platforms: { ios: null } };

module.exports = {
  dependencies: HAS_IOS_FIREBASE
    ? {}
    : {
        '@react-native-firebase/app': androidOnly,
        '@react-native-firebase/crashlytics': androidOnly,
      },
};
