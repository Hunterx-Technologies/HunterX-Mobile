// Re-applies the Xcode 27 / iOS 27 fixes that used to be hand edits in ios/
// (which `expo prebuild --clean` deletes):
//  1. iOS 27 terminates apps that don't adopt the UIScene lifecycle, so add
//     a SceneDelegate that attaches the existing window to the scene and
//     forwards deep links / universal links to the AppDelegate.
//  2. Xcode 27 rejects pod targets below iOS 15, so raise them to 15.1.
const { withAppDelegate, withInfoPlist, withPodfile } = require('expo/config-plugins');

const MARKER = '// [withXcode27Compat] SceneDelegate';

const SCENE_DELEGATE = `
${MARKER}
// iOS 27 terminates apps that don't adopt the UIScene lifecycle
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

    let window = appDelegate.window ?? UIWindow(frame: windowScene.coordinateSpace.bounds)
    window.windowScene = windowScene
    window.makeKeyAndVisible()
    self.window = window
    appDelegate.window = window

    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }
    if let userActivity = connectionOptions.userActivities.first {
      self.scene(scene, continue: userActivity)
    }
  }

  // Linking API
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
      options[.sourceApplication] = context.options.sourceApplication
      options[.annotation] = context.options.annotation
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  // Universal Links
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

const POD_TARGET_FIX = `
    # [withXcode27Compat] Xcode 27 rejects pod targets below iOS 15
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        if bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 15.1
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end
`;

function withSceneDelegate(config) {
  config = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withXcode27Compat: expected a Swift AppDelegate');
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /\nclass ReactNativeDelegate:/,
        `${SCENE_DELEGATE}\nclass ReactNativeDelegate:`,
      );
      if (!cfg.modResults.contents.includes(MARKER)) {
        throw new Error('withXcode27Compat: could not find ReactNativeDelegate in AppDelegate.swift');
      }
    }
    return cfg;
  });
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withPodTargetFloor(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults.contents;
    if (podfile.includes('[withXcode27Compat]')) return cfg;
    // Insert at the end of the post_install block, after react_native_post_install(...).
    const next = podfile.replace(
      /(react_native_post_install\([\s\S]*?\n\s*\)\n)/,
      `$1${POD_TARGET_FIX}`,
    );
    if (next === podfile) throw new Error('withXcode27Compat: react_native_post_install not found in Podfile');
    cfg.modResults.contents = next;
    return cfg;
  });
}

module.exports = (config) => withPodTargetFloor(withSceneDelegate(config));
