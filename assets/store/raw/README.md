# Raw store screenshots

Put raw, unframed screenshots here, then run `npm run assets`. Each one is
framed (caption, device frame, black/white/orange) into:

- `../apple/iphone-6.9/` at 1320x2868 (App Store, required set)
- `../apple/iphone-6.5/` at 1284x2778 (App Store, accepted fallback)
- `../google/phone/` at 1080x1920 (Google Play phone)

Files are used in name order, so prefix them: `01-home.png`, `02-quests.png`, …
Apple takes 3–10 and Google Play takes 2–8. Use 6–8 so both stores get a
full set.

## How to capture

- Capture on an iPhone 16/17 Pro Max (or the 6.9" simulator) in portrait. One
  raw set is reused for every output size, and the frame keeps the
  screenshot's aspect ratio, so it is never stretched.
- PNG, no transparency. Simulator: `xcrun simctl io booted screenshot 01-home.png`.
- Use a demo account with believable data: a live streak, XP partway through
  a level, and a rank above Dormant. Avoid real names or emails.
- Set the status bar to a clean state before capturing:
  `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4`.

## Screens to capture

| File | Screen | Route | Show |
|---|---|---|---|
| `01-home.png` | Home / today's quests | `app/(tabs)/index.tsx` | Daily quests with some completed, XP bar, current streak |
| `02-day-complete.png` | Day complete celebration | `app/day-complete.tsx` | XP earned and the streak count-up |
| `03-leaderboard.png` | Leaderboard | `app/(tabs)/leaderboard.tsx` | Top 5 podium with the user's own rank visible |
| `04-metrics.png` | Health metrics | `app/(tabs)/metrics.tsx` | Steps, calories and sleep synced from Health / Health Connect |
| `05-rewards.png` | Rewards | `app/rewards.tsx` | A reward card being revealed |
| `06-profile.png` | Profile and rank | `app/(tabs)/profile.tsx` | Rank badge, level and streak badges |
| `07-onboarding.png` | Onboarding oath (optional) | `app/(onboarding)/oath.tsx` | The "become a hunter" moment |
| `08-notifications.png` | Notifications (optional) | `app/notifications.tsx` | Streak reminder and quest alerts |

## Captions

Captions come from `../captions.json`, keyed by raw file name. `highlight`
lists the words drawn in orange. A screenshot with no entry is framed
without a caption.
