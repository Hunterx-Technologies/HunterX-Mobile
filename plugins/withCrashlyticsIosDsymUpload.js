// Uploads the app's dSYM (debug symbols) to Firebase Crashlytics after each
// iOS Release build. Without it Crashlytics receives iOS crashes but can't
// symbolicate them ("unprocessed crash, upload dSYM"). The stock
// @react-native-firebase/crashlytics plugin only sets this up for Android.
// Added by app.config.ts only when GoogleService-Info.plist is present.
const { withXcodeProject } = require('expo/config-plugins');

const PHASE_NAME = '[Crashlytics] Upload dSYMs';

const SCRIPT = [
  '# Debug builds have no dSYM to upload.',
  'if [[ "$CONFIGURATION" == *Debug* ]]; then exit 0; fi',
  '"${PODS_ROOT}/FirebaseCrashlytics/run"',
].join('\n');

// Firebase's documented input files: the run script needs them declared so
// Xcode runs it after the dSYM and the bundled plist exist.
const INPUT_PATHS = [
  '${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}',
  '${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}/Contents/Resources/DWARF/${PRODUCT_NAME}',
  '${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}/Contents/Info.plist',
  '$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/GoogleService-Info.plist',
  '$(TARGET_BUILD_DIR)/$(EXECUTABLE_PATH)',
];

module.exports = function withCrashlyticsIosDsymUpload(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase || {};
    const exists = Object.values(phases).some(
      (phase) => typeof phase === 'object' && phase.name === `"${PHASE_NAME}"`
    );
    if (!exists) {
      project.addBuildPhase([], 'PBXShellScriptBuildPhase', PHASE_NAME, project.getFirstTarget().uuid, {
        shellPath: '/bin/sh',
        shellScript: SCRIPT,
        inputPaths: INPUT_PATHS.map((p) => `"${p}"`),
      });
    }
    return cfg;
  });
};
