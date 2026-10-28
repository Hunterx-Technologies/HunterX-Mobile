# Brand assets

Every icon, splash, store graphic and website icon is generated from one
master logo. Don't edit generated files by hand: change the master or the
script, then regenerate.

```sh
npm run assets          # regenerate everything
npm run assets:verify   # check every file; exits 1 on any failure
open assets/preview.html  # eyeball cropping in every icon shape
```

`assets:verify -- --release` also fails if store screenshots are missing.

## Inputs

| Input | Purpose |
|---|---|
| `assets/source/logo.svg` | Preferred master, if one ever exists. It wins over `logo.png`. |
| `assets/source/logo.png` | Current master: the transparent X-and-sword mark, 1024x1024 raster. |
| `theme/colors.ts` | `palette.orange` and `palette.black` are the brand colours. Change them there. |
| `assets/store/raw/*.png` | Raw screenshots for the store frames. See `assets/store/raw/README.md`. |
| `assets/store/captions.json` | Caption and orange highlight word(s) per raw screenshot. |

**About the master.** No vector logo, and no raster at 2048px or larger,
exists. The best available art is `assets/images/app_logo.png` (1024px, mark
on a glass tile). `logo.png` is that file's original pixels, cut out with the
splash animation's stroke and sword masks, so it has no tile and no
upscaling. It was built with `node scripts/generate-assets.mjs --extract-master`.
The mark is about 735px across, so every output is at or below native
resolution, and the script warns if anything would need upscaling. When a
proper SVG or 2048px+ export of the mark arrives, save it as
`assets/source/logo.svg` (or replace `logo.png`) and rerun.

The logo is blue and gold. Per the brand rules it is never recoloured: black,
white and orange are used only around it (backgrounds, text, frames). Only
the single-colour silhouettes (Android monochrome, notification, Safari
pinned tab) are white or black. They are cut from the logo's own pixels, not
redrawn.

The website repo is expected at `../HunterX-Web/hunterx-web`. Set
`WEB_PUBLIC_DIR=/path/to/public` to override. If it's missing, web files are
skipped with a warning.

## Outputs

### App (`assets/images/`, wired in `app.json`)

| File | Spec | Used by |
|---|---|---|
| `icon.png` | 1024, RGB no alpha, black, square | `expo.icon`, `ios.icon.light`, App Store icon |
| `icon-dark.png` | 1024, transparent | `ios.icon.dark` (iOS 18+ dark icons) |
| `icon-tinted.png` | 1024, greyscale on black | `ios.icon.tinted` |
| `adaptive-icon-foreground.png` | 1024, transparent, art inside the centre 66% circle | `android.adaptiveIcon.foregroundImage` |
| `adaptive-icon-monochrome.png` | 1024, white on transparent, same safe zone | `android.adaptiveIcon.monochromeImage` (Android 13+ themed icons) |
| `splash-icon.png` | 1024, transparent, art inside the Android 12 192/288dp circle | `expo-splash-screen` (`imageWidth` 200, background `#000000`) |
| `notification-icon.png` | 96, white on transparent | `expo-notifications` `icon`, `color` = orange |
| `favicon.png` | 48 | `web.favicon` (Expo web) |

`android.adaptiveIcon.backgroundColor` is `#000000`.

### Native (`ios/`, `android/`: generated, gitignored)

These are created by `npx expo prebuild` from the config above. Don't hand-edit
them, because prebuild overwrites them. `assets:verify` checks them whenever
the folders exist:

- iOS: `AppIcon.appiconset` with one 1024 universal icon, plus dark and tinted
  appearances, no alpha. `SplashScreen.storyboard` is black with the logo.
- Android: `mipmap-*/ic_launcher` and `ic_launcher_round` (48–192px), plus
  `ic_launcher_foreground` and `ic_launcher_monochrome` (108dp: 108–432px).
  `mipmap-anydpi-v26/ic_launcher.xml` has background, foreground and
  monochrome layers. Expo writes these as `.webp`.
- Android: `drawable-*/notification_icon.png` (24–96px, white). The manifest
  sets `com.google.firebase.messaging.default_notification_icon` and
  `default_notification_color` (orange). Expo's name for this icon is
  `notification_icon`, not `ic_notification`.
- Android 12+ splash: `drawable-*/splashscreen_logo.png` (288dp, logo inside
  the 192dp circle) on `splashscreen_background` `#000000`.

`plugins/withXcode27Compat.js` re-applies two iOS fixes that used to be hand
edits in `ios/`: the UIScene `SceneDelegate` and the iOS 15.1 minimum for pod
targets.

### Store listings (`assets/store/`)

| File | Upload to |
|---|---|
| `apple/app-store-icon-1024.png` | Not uploaded. App Store Connect takes the icon from the build. Keep it for reference and marketing. |
| `apple/iphone-6.9/*.png` (1320x2868) | App Store Connect › iOS App › Previews and Screenshots › **iPhone 6.9" Display** |
| `apple/iphone-6.5/*.png` (1284x2778) | Same page › **iPhone 6.5" Display**. Optional, because Apple scales the 6.9" set down. |
| `google/play-icon-512.png` (512, 32-bit, opaque) | Play Console › Grow › Store presence › Main store listing › **App icon** |
| `google/feature-graphic-1024x500.png` | Same page › **Feature graphic** |
| `google/phone/*.png` (1080x1920) | Same page › **Phone screenshots** |

There is no iPad or tablet set, because `ios.supportsTablet` is `false` and
the app is phone-only. Screenshot folders stay empty until raws are added to
`assets/store/raw/`.

### Website (`../HunterX-Web/hunterx-web/public/`)

`favicon.ico` (16/32/48), `icon.svg`, `favicon-16x16.png`,
`favicon-32x32.png`, `apple-touch-icon.png` (180, no alpha),
`android-chrome-192x192.png`, `android-chrome-512x512.png`,
`maskable-512x512.png` (art inside the centre 80%), `site.webmanifest`,
`safari-pinned-tab.svg` (traced, single colour), `og-image.png` (1200x630) and
`twitter-image.png` (1200x600).

These are wired in that repo's `src/app/layout.tsx` (`metadata.icons`,
`manifest`, `openGraph`, `twitter`) and `src/lib/seo.ts` (per-page social
images). `themeColor` lives in the `viewport` export, as Next.js requires.
`icon.svg` embeds the raster mark, because the logo is not vector art.

## Checks (`npm run assets:verify`)

For every file it checks exact pixel size, format, byte limit, sRGB, and alpha:

- **Must have no alpha:** `icon.png`, App Store icon, apple-touch-icon, store
  screenshots, feature graphic.
- **Must be 32-bit but fully opaque:** Play icon.
- **Must have alpha:** adaptive, monochrome, notification and splash icons.

It also checks that silhouettes are white only, artwork stays inside each
safe-zone circle, the ICO holds 16/32/48, the pinned-tab SVG is one colour,
and the manifest icons match their files. It resolves `npx expo config` to
confirm the wiring and checks the prebuild output when `ios/` and `android/`
exist.

## After changing the logo or colours

```sh
npm run assets && npm run assets:verify
npx expo prebuild --clean   # then rebuild the dev client / EAS build
```

Commit the regenerated files in both repos.
