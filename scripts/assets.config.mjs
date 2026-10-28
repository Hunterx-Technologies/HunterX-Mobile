// Shared paths, brand tokens and output specs for the brand asset pipeline.
// generate-assets.mjs writes these files; verify-assets.mjs checks them.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const r = (...p) => path.join(ROOT, ...p);

export const SOURCE_DIR = r('assets/source');
export const MASTER = r('assets/source/logo-mark.png');
export const IMAGES_DIR = r('assets/images');
export const STORE_DIR = r('assets/store');
export const RAW_SCREENSHOTS_DIR = r('assets/store/raw');
export const CAPTIONS = r('assets/store/captions.json');
export const PREVIEW = r('assets/preview.html');

// The website lives in its own repo next to this one. Override with
// WEB_PUBLIC_DIR=/path/to/hunterx-web/public when the layout differs.
export const WEB_PUBLIC_DIR = path.resolve(
  process.env.WEB_PUBLIC_DIR || r('../HunterX-Web/hunterx-web/public'),
);

export const FONTS = {
  black: r('node_modules/@expo-google-fonts/inter/900Black/Inter_900Black.ttf'),
  bold: r('node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  medium: r('node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
};

// Brand colours come from the app theme so there is one source of truth.
function readPaletteColor(key) {
  const src = fs.readFileSync(r('theme/colors.ts'), 'utf8');
  const m = src.match(new RegExp(`\\b${key}:\\s*'(#[0-9A-Fa-f]{6})'`));
  if (!m) throw new Error(`theme/colors.ts: palette.${key} not found`);
  return m[1].toUpperCase();
}

export const BRAND = {
  name: 'HunterX',
  tagline: 'Level up your real life',
  orange: readPaletteColor('orange'),
  black: readPaletteColor('black'),
  white: '#FFFFFF',
  muted: '#A1A1AA',
};

// Store screenshot targets. Apple's 6.9" set is required; 6.5" is the
// accepted fallback. iPad is skipped because ios.supportsTablet is false.
export const SCREENSHOT_SETS = [
  { dir: 'apple/iphone-6.9', width: 1320, height: 2868, min: 3, max: 10, maxBytes: 8 * 1024 * 1024 },
  { dir: 'apple/iphone-6.5', width: 1284, height: 2778, min: 3, max: 10, maxBytes: 8 * 1024 * 1024 },
  { dir: 'google/phone', width: 1080, height: 1920, min: 2, max: 8, maxBytes: 8 * 1024 * 1024 },
];

const KB = 1024;
const MB = 1024 * KB;

// alpha: 'none'     -> RGB, no alpha channel
//        'opaque'   -> 32-bit RGBA but every pixel fully opaque (Play icon)
//        'required' -> RGBA with real transparency
// white: every visible pixel must be pure white (notification/monochrome)
export const SPECS = [
  // Expo app config (assets/images)
  { group: 'app', file: 'assets/images/icon.png', w: 1024, h: 1024, format: 'png', alpha: 'none', maxBytes: 1 * MB },
  { group: 'app', file: 'assets/images/icon-dark.png', w: 1024, h: 1024, format: 'png', alpha: 'required', maxBytes: 1 * MB },
  { group: 'app', file: 'assets/images/icon-tinted.png', w: 1024, h: 1024, format: 'png', alpha: 'none', maxBytes: 1 * MB },
  { group: 'app', file: 'assets/images/adaptive-icon-foreground.png', w: 1024, h: 1024, format: 'png', alpha: 'required', maxBytes: 1 * MB, safeRadius: 0.33 },
  { group: 'app', file: 'assets/images/adaptive-icon-monochrome.png', w: 1024, h: 1024, format: 'png', alpha: 'required', white: true, maxBytes: 512 * KB, safeRadius: 0.33 },
  { group: 'app', file: 'assets/images/splash-icon.png', w: 1024, h: 1024, format: 'png', alpha: 'required', maxBytes: 1 * MB, safeRadius: 192 / 288 / 2 },
  { group: 'app', file: 'assets/images/notification-icon.png', w: 96, h: 96, format: 'png', alpha: 'required', white: true, maxBytes: 32 * KB },
  { group: 'app', file: 'assets/images/favicon.png', w: 48, h: 48, format: 'png', alpha: 'required', maxBytes: 32 * KB },

  // Store listings (assets/store)
  { group: 'store', file: 'assets/store/apple/app-store-icon-1024.png', w: 1024, h: 1024, format: 'png', alpha: 'none', maxBytes: 1 * MB },
  { group: 'store', file: 'assets/store/google/play-icon-512.png', w: 512, h: 512, format: 'png', alpha: 'opaque', maxBytes: 1 * MB },
  { group: 'store', file: 'assets/store/google/feature-graphic-1024x500.png', w: 1024, h: 500, format: 'png', alpha: 'none', maxBytes: 15 * MB },

  // Website (WEB_PUBLIC_DIR)
  { group: 'web', file: 'favicon.ico', format: 'ico', icoSizes: [16, 32, 48], maxBytes: 64 * KB },
  { group: 'web', file: 'icon.svg', format: 'svg', maxBytes: 128 * KB },
  { group: 'web', file: 'favicon-16x16.png', w: 16, h: 16, format: 'png', alpha: 'required', maxBytes: 8 * KB },
  { group: 'web', file: 'favicon-32x32.png', w: 32, h: 32, format: 'png', alpha: 'required', maxBytes: 16 * KB },
  { group: 'web', file: 'apple-touch-icon.png', w: 180, h: 180, format: 'png', alpha: 'none', maxBytes: 128 * KB },
  { group: 'web', file: 'android-chrome-192x192.png', w: 192, h: 192, format: 'png', alpha: 'none', maxBytes: 128 * KB },
  { group: 'web', file: 'android-chrome-512x512.png', w: 512, h: 512, format: 'png', alpha: 'none', maxBytes: 512 * KB },
  { group: 'web', file: 'maskable-512x512.png', w: 512, h: 512, format: 'png', alpha: 'none', maxBytes: 512 * KB, safeRadius: 0.4 },
  { group: 'web', file: 'safari-pinned-tab.svg', format: 'svg', singleColor: true, maxBytes: 64 * KB },
  { group: 'web', file: 'site.webmanifest', format: 'manifest', maxBytes: 4 * KB },
  { group: 'web', file: 'og-image.png', w: 1200, h: 630, format: 'png', alpha: 'none', maxBytes: 5 * MB },
  { group: 'web', file: 'twitter-image.png', w: 1200, h: 600, format: 'png', alpha: 'none', maxBytes: 5 * MB },
];

export const specPath = (spec) =>
  spec.group === 'web' ? path.join(WEB_PUBLIC_DIR, spec.file) : r(spec.file);
