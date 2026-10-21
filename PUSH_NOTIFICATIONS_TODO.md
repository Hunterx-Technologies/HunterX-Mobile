# Push Notifications — Implementation TODO

Tick items off as they land. Each item lists **where** it lives (📱 mobile / 🖥️ backend) and the
settings key that gates it. Work top to bottom — later phases depend on Phase 0–1.

Current state (2026-10-08): no `expo-notifications`, no device-token registration, the 9 `notify_*`
toggles in `SystemSettingsModal` are saved but drive nothing, and the Home bell icon has no `onPress`.

---

## Phase 0 — Foundation (mobile) ✅ code done — needs credentials + a new dev build to run on a phone

Done (2026-10-09):
- `expo-notifications ~0.32.17` installed, plugin in `app.json` (icon `android-icon-monochrome.png`, color `#FE5B01`)
- `services/notifications/push.ts` — permission, Android channels (`reminders|streaks|rewards|social|system`), Expo token,
  register/unregister with backend (30-min throttle; also refreshes backend `last_seen_at` for win-back), foreground rules
  (LEVEL_UP / STREAK_MILESTONE / REWARD_READY don't show a banner while the app is open — fixes 3.6), app icon badge
- `hooks/usePushNotifications.ts` (mounted in `app/_layout.tsx`) — registers on sign-in / every foreground / token rotation,
  refreshes unread count on receive, routes taps to `data.url` (cold start included, held until auth + index redirect finish),
  marks the tapped notification read (5.5)
- `hooks/usePushPermissionPrompt.ts` + `ConfirmDialog` on Home — "Let the System summon you" explainer, offered once after the
  hunter has XP, never over another Home modal; "Not now" is remembered
- Logout unregisters the device first (`useAuthStore.logout`) and zeroes the badge
- System Settings: banner when push is off at OS level (Enable → OS prompt, or → phone Settings if denied);
  "Remind me at" time chips under Task Reminders (`reminder_time`); dead local notification flags removed from `useSettingsStore`/profile
- Live-tested against the local backend: device register/validate/unregister, settings timezone/reminder_time,
  broadcast preview/send, quiet-hours deferral, dispatcher `no_device`, inbox list/unread/read, broadcast history

**Device testing tools** (backend, disabled in production unless `PUSH_TEST_ENABLED=true`):
- `POST /api/notifications/test` (Bearer token) — body optional `{ type, title, body, url }` → sends the caller a push
  immediately, ignoring settings / quiet hours / cap; returns `{ devices, push_status, push_error }`
- `npm run push:test -- <userId|email> [TYPE] [/route]` in HunterX-Backend — same thing without a token
- Android dev build #1 (1fa0270c) failed: Health Connect needs minSdk 26 but EAS used 24 — `android.minSdkVersion` in
  app.json is ignored on SDK 54 (local `android/` had been hand-edited). Fixed with `expo-build-properties` plugin
  (`android.minSdkVersion: 26`). Build #2 ✅ FINISHED: https://expo.dev/accounts/shakthi24s-team/projects/shakthi/builds/c0690ff6-31b5-4e10-8968-72b28acaf7ed
- Standalone APK (no Metro): `eas build --profile apk-local --platform android` — new `apk-local` profile in eas.json
  (extends `preview`, APK, `EXPO_PUBLIC_API_URL=http://192.168.1.12:5001/api`, `ALLOW_CLEARTEXT_HTTP=true` → app.config.ts
  enables cleartext for that profile only). `preview` is now APK too and reads EXPO_PUBLIC_GOOGLE_CLIENT_ID_* from the EAS
  "preview" environment. Update the LAN IP in eas.json if the Mac's IP changes.
  Build ✅ FINISHED: https://expo.dev/accounts/shakthi24s-team/projects/shakthi/builds/8eaa934c-ba8d-4a08-a999-f6d1ad5c3c1a

**Still needed before a real push arrives (you):**
- [x] **Android — FCM v1 key → EAS** (2026-10-09): service account `firebase-adminsdk-fbsvc@hunterx-504217`, key id `82a586…`,
  assigned to `com.hunterx.mobile`. Local copy at `~/Documents/creds/` (gitignored pattern added — never commit it).
  Consider rotating it in Google Cloud → IAM → Service Accounts (it was pasted into a chat) and re-uploading.
- [x] **Android — `google-services.json`** (2026-10-09): in repo root (app `1:991893509642:android:f5eef7b833b7a46c4971f3`),
  wired via `android.googleServicesFile` in `app.json`. Not a secret — commit it.
- [ ] **iOS:** `eas credentials` (iOS → Push Notifications) to create/upload an APNs key (needs the Apple Developer account)
- [ ] **New dev build** — `eas build --profile development` for both platforms (native module + plugin added); the
  current dev client can't load `expo-notifications`
- [ ] Optional: `EXPO_ACCESS_TOKEN` in backend env if "Enhanced push security" is enabled at expo.dev
- [ ] Optional: "When do you train?" onboarding step (0.6) — reminder time is only settable in System Settings for now

Original checklist (kept for reference):

- [ ] **0.1 Install & configure** 📱
  - `npx expo install expo-notifications`
  - Add `expo-notifications` to `plugins` in `app.json` (notification icon + `#0A0E17`-style accent color)
  - Upload APNs key + FCM v1 credentials to EAS (`eas credentials`); `extra.eas.projectId` already set
  - Rebuild dev client (native module change)
- [ ] **0.2 Android notification channels** 📱 — create on app start:
  `reminders`, `streaks`, `rewards`, `social`, `system`
- [ ] **0.3 `services/notifications/` module** 📱
  - `registerForPushNotifications()` → permission check + `getExpoPushTokenAsync({ projectId })`
  - `setNotificationHandler` (foreground display behaviour)
  - Skip on web / simulator (`expo-device` `isDevice`)
- [ ] **0.4 Permission priming flow** 📱
  - Custom "Allow the System to summon you" explainer screen/modal before the OS prompt
  - Show after the Oath / first completed quest — **not** on first launch
  - Remember "asked" state; if denied, don't re-prompt — surface a settings banner instead (see 0.8)
- [ ] **0.5 Token registration** 📱🖥️
  - 🖥️ `POST /users/me/devices` `{ token, platform, app_version, timezone }` (upsert)
  - 🖥️ `DELETE /users/me/devices/:token`
  - 📱 Register after login / signup / app foreground; listen to `addPushTokenListener` for rotation
  - 📱 Unregister on logout (`app/(tabs)/profile.tsx` logout handler) and account deletion
- [ ] **0.6 Timezone + preferred reminder time** 📱🖥️
  - 📱 Send `Intl.DateTimeFormat().resolvedOptions().timeZone` with device registration / profile
  - 📱 Add "When do you train?" (morning / afternoon / evening / custom) — onboarding step after
    `app/(onboarding)/time.tsx` and editable in System Settings
  - 🖥️ Store `timezone`, `reminder_time` on user settings
- [ ] **0.7 Tap handling / deep links** 📱
  - In `app/_layout.tsx`: `addNotificationResponseReceivedListener` + `getLastNotificationResponseAsync`
    (cold start) → `router.push(data.url)`
  - Wait for auth hydration before routing; ignore if logged out
  - Payload contract: `{ type, url, ...ids }`
- [ ] **0.8 Settings cleanup** 📱
  - Remove duplicate local notification flags from `store/useSettingsStore.ts`
    (`allNotificationsEnabled`, `taskRemindersEnabled`, `streakAtRiskEnabled`, …) — backend `notify_*` is the source of truth
  - In `SystemSettingsModal`, if OS permission is denied show "Notifications are off — Open Settings"
    (`Linking.openSettings()`) instead of dead toggles

## Phase 1 — Backend sending infrastructure ✅ (code done in HunterX-Backend, migration not yet applied)

Design: `notifications` table = push **outbox**. `createNotification()` (unchanged signature, still
called inside transactions by xpService/rewardService) writes the row `PENDING`; a dispatcher cron
sends it after commit — so a rolled-back level-up never pushes. Transport = **Expo Push API**
(the unused `firebase-admin` dependency and `src/config/firebase.js` were removed).

- [x] **1.1 Device token table** 🖥️ — `user_push_tokens` (replaces the unused `user_fcm_tokens`):
  unique `token`, `platform`, `app_version`, `last_seen_at`; many devices per user
  - `POST /api/users/me/devices` `{ token, platform: IOS|ANDROID, app_version?, timezone? }` (upsert; also updates `user_settings.timezone`)
  - `DELETE /api/users/me/devices` body `{ token }`
- [x] **1.2 Sending** 🖥️ — `src/services/pushService.js` (Expo transport, chunks of 100, optional `EXPO_ACCESS_TOKEN`)
  + `src/services/pushDispatchService.js` (claim → send → SENT / retry ×3 with backoff / FAILED;
  receipt check every 15 min; `DeviceNotRegistered` tokens deleted)
  - Gating via `config/notificationTypes.js` → `isNotificationEnabled()` (`notify_all` + type's `notify_*`)
- [x] **1.3 Guardrails** 🖥️ (in `createNotification`) — quiet hours 22:00–07:00 local (deferred via `deliver_after`),
  daily cap 3 for `DAILY_MOTIVATION`/`TASK_REMINDER` (over-cap rows stay in inbox as `SKIPPED`),
  `options.dedupeKey` for idempotent scheduled jobs, backlog older than 6h expires instead of blasting
- [x] **1.4 Notification log** 🖥️ — `notifications.push_status|push_attempts|pushed_at|push_error|deliver_after|dedupe_key`
  + `push_receipts` table; pre-existing rows backfilled to `SKIPPED`
- [x] **1.5 Timezone-aware scheduler** 🖥️ — `src/cron/notificationScheduler.js`, every 15 min,
  `SCHEDULED_NOTIFICATION_JOBS` registry (empty — Phase 2 adds jobs);
  `user_settings.timezone` (default `Asia/Kolkata`) + `reminder_time` (default `19:00`), both settable via `PATCH /me/settings`
- [x] **1.6 Apply migration** — applied to the local DB 2026-10-09 (no drift; 4 old rows backfilled SKIPPED). **Prod/UAT:** Railway's start command already runs `prisma migrate deploy`
- [ ] **1.7 Push data contract for mobile** 📱 — every push carries `data: { notification_id, type, url, ...event fields }`;
  Android `channelId` ∈ `reminders | streaks | rewards | social | system` (must match 0.2)

## Phase 2 — P0 Retention (core habit loop) ✅ (code done in HunterX-Backend)

All in `src/services/scheduledNotificationJobs.js`, run by `src/cron/notificationScheduler.js`.
Tasks/streaks/weeks roll over on **IST**, so deadline jobs run on the IST clock; "nice moment" jobs
run at the user's local time. Deadline jobs pass `expiresAt` → dropped if quiet hours would push them past the deadline.

- [x] **2.1 Daily quest reminder** — user-local `reminder_time` (default 19:00), only if today's daily tasks are still open
  - "Quests await, Hunter" · `TASK_REMINDER` · `notify_task_reminders`
- [x] **2.2 Streak at risk** — 20:00 IST (4h before the IST day closes), streak > 0, nothing done today;
  copy says whether missing today costs a streak life or resets to zero
  - "🔥 12-day streak in danger" · `STREAK_AT_RISK` · `notify_streak_preservation`
  - ⚠️ mobile `constants/streakRules.ts` `STREAK_GRACE_PERIOD_HOURS = 6` is **not** a backend rule — backend breaks at IST midnight
- [x] **2.3 Streak status after a miss** — user-local 09:00: shielded by lives → `STREAK_FREEZE_USED`
  ("A streak life is shielding you"); gap too long → reconciles the break (write-through) + `STREAK_BROKEN` · `notify_streak_freeze`
- [x] **2.4 Weekly quest deadline** — Saturday 18:00 IST, open WEEKLY tasks this week · `TASK_REMINDER`
- [x] **2.5 Daily motivation** — user-local 07:00, same quote for everyone per day from `quotes` (active rows,
  sets `notifications.quote_id`), built-in pool of 8 lines while that table is empty · `DAILY_MOTIVATION`
- [ ] **2.6 Copy review** — titles/bodies above are first drafts in the "System / Hunter" voice
- [ ] **2.7 Seed `quotes`** (optional) — motivation uses the fallback pool until then

## Phase 3 — P1 Progress & rewards ✅ (code done in HunterX-Backend)

- [x] **3.1 Streak milestone / badge earned** — already created by `rewardService.checkAndAwardStreakMilestoneBadge`
  (7/14/30/60/90/200/365); now delivered via the outbox · `STREAK_MILESTONE` · → `/(tabs)/profile`
- [x] **3.2 Level up / rank up / dragon evolution** — already created by `xpService.checkLevelUp`; now delivered · `LEVEL_UP`
- [x] **3.3 Reward ready** — added to `rewardService.grantCoupon` (streak-milestone coupon):
  "🎁 Reward unlocked — Your 7-day streak earned 20% off from MuscleBlaze." · `REWARD_READY` · → `/rewards`
  (`data.user_reward_id`). No LEVEL_UP / REFERRAL coupon grant exists in the backend yet — hook in when it does.
- [x] **3.4 Reward expiring** — job `reward_expiring`, user-local 10:00, ACTIVE rewards expiring within 48h
  (`user_rewards.expires_at`, else `reward_pool.expires_at`), once per reward · `REWARD_READY` (`event: REWARD_EXPIRING`)
  - ⚠️ Mobile `app/rewards.tsx` still renders `INITIAL_COUPONS` mock data — the tap lands on mock coupons until it uses a real API
- [x] **3.5 New admin quest** — job `new_quest`, 08:00 IST, admin-created DAILY_ADMIN/WEEKLY task assigned today
  and never assigned to this user before (recurring quests announce once) · new type **`NEW_QUEST`**
  (gated by `notify_task_reminders`, not capped) — enum value added to the Phase 1 migration
- [x] **3.6 Burst on one completion** (mobile foreground handler hides these banners) — a single task completion can queue LEVEL_UP + RANK_UP + DRAGON_EVOLUTION
  (+ STREAK_MILESTONE + REWARD_READY) at once. User is in-app at that moment, so plan: mobile foreground handler
  suppresses the banner (Phase 0.3) — or collapse server-side later if it's noisy in background
- [ ] **3.7 Pre-existing bug (not push-related)** — 21-day `STREAK_21` coupon never grants: `bumpDailyStreak` routes 21
  to `checkAndAwardStreakMilestoneBadge`, which returns early because `STREAK_MILESTONE_BADGES` has no 21 entry

## Phase 4 — P1 Social & referral ✅ (backend + mobile settings done)

- [x] **4.1 New settings keys** — `notify_social`, `notify_leaderboard` (default on): backend schema/migration +
  `userSettingsService`; mobile `UserSettings` type + "Friends & Referrals" / "Leaderboard Updates" toggles in `SystemSettingsModal`
- [x] **4.2 + 4.3 Friend joined (+ referral XP)** — one push, not two: added inside `authService.awardReferralXpIfEligible`
  (fires when the invited friend finishes onboarding, same transaction that pays the referrer +50 XP)
  - "⚔️ Asha answered your call — Your Guest Pass recruit just became a hunter. +50 XP earned." · new type `FRIEND_JOINED`
    · `notify_social` · channel `social` · → `/(tabs)/leaderboard`
- [x] **4.4 Leaderboard digest** — job `leaderboard_digest`, user-local 18:00, max one push/day, new type `LEADERBOARD_UPDATE`
  (`notify_leaderboard`, capped). Diffs today's ranks vs `leaderboard_rank_snapshots`:
  broke into global top 10 / top 100 → a named friend passed you (+ XP gap) → you climbed among friends.
  First run = baseline only; `leaderboard_visible = false` → unranked, never pushed.
  - Dropped from plan: "weekly final rank" — leaderboards are all-time XP, there's no weekly board

## Phase 5 — Inbox (bell icon) ✅ 5.1–5.3 (not yet seen running — needs the migration applied)

- [x] **5.1 API** 🖥️ — `src/routes/notifications.js` + `notificationService.listNotifications / getUnreadCount / markNotificationsRead`
  - `GET /api/notifications?cursor=<id>&limit=20` → `{ notifications, next_cursor, unread_count }` (newest first, max 50)
  - `GET /api/notifications/unread-count` → `{ unread_count }`
  - `POST /api/notifications/read` `{ ids: [...] }` or `{ all: true }` → `{ unread_count }` (own rows only)
  - A row appears once due (`deliver_after <= now`) — quiet-hours-deferred items don't show early; cap-SKIPPED ones still show
  - Each item carries a resolved `url` (`data.url`, else the type's default route)
- [x] **5.2 Inbox screen** 📱 — `app/notifications.tsx`: per-type icon, unread dot + tint, relative time, tap → mark read + open `url`,
  "Read all", pull-to-refresh, infinite scroll, skeleton / empty / error+retry states; header per AGENTS.md
  - New: `services/api/notifications.service.ts`, `types/notification.ts`, `store/useNotificationStore.ts`, `formatRelativeTime` in `utils/formatters.ts`
- [x] **5.3 Bell wiring** 📱 — Home bell opens `/notifications`, orange count badge (9+), count refreshed on Home focus
- [x] **5.4 App icon badge** — `useNotificationStore.setUnreadCount` mirrors to `setBadgeCountAsync`
- [x] **5.5 Mark read on push tap** — `usePushNotifications` marks `data.notification_id` read when routing a tap

## Phase 6 — P2 Account & system ✅ 6.1–6.4 (backend + admin page; admin page not yet seen running)

- [x] **6.1 Feedback status change** — `feedbackService.updateFeedbackStatus` (admin `PATCH /admin/feedback/:id/status`):
  `in_review` / `resolved` → new type `FEEDBACK_UPDATE`, transactional (ignores `notify_all`), only if the report has
  `allow_followup`, once per status · → `/feedback`
- [x] **6.2 Health sync broken** — job `health_sync`, user-local 11:00: newest `health_metrics_daily` row exactly 3 or 7 IST days old
  (users who never synced are skipped) · new type `HEALTH_SYNC` (`notify_task_reminders`, capped) · → `/(tabs)/metrics`
- [x] **6.3 Broadcasts** — backend `broadcastService.js` + admin routes:
  - `POST /api/admin/notifications/broadcast` `{ title ≤65, body ≤240, url?, audience: all|inactive|users, inactive_days?, user_ids?, dry_run? }`
  - `GET /api/admin/notifications/broadcasts` → history with recipients / pushed / pending / not_pushed / read
  - Excludes `notify_announcements`/`notify_all` off; per-user quiet hours; idempotent per broadcast (`dedupe_key`)
  - **HunterX-Admin**: Notifications page (was "Coming soon") — compose, destination picker, notification preview,
    "Preview recipients" (dry run) → "Send to N", history table; sidebar item enabled
- [x] **6.4 Win-back** — job `win_back`, user-local 12:00, exactly 3 / 7 / 14 local days since last seen
  (newest of device `last_seen_at` and `last_active_date`), then silent · new type `WIN_BACK` (`notify_daily_motivation`, capped)
  - ⚠️ Relies on Phase 0.5 re-registering the device on every app foreground to keep `last_seen_at` fresh
- [ ] **6.5 Trial / Guest Pass ending** 🖥️ — *blocked until RevenueCat (`hooks/usePremium.ts`)* · always on
- [ ] **6.6 Scheduled broadcasts** (optional) — admin page sends immediately; add `send_at` if scheduling is wanted

## Phase 7 — QA & release

- [ ] Test matrix: iOS + Android × foreground / background / killed × logged in / logged out
- [ ] Verify every `notify_*` toggle actually suppresses its type; `notify_all = false` suppresses all non-transactional
- [ ] Verify deep link for every type, including cold start
- [ ] Verify logout stops pushes to that device; reinstall gets a fresh token
- [ ] Timezone edge cases (user travels, DST change)
- [ ] Copy review for all notification texts (keep the "System / Hunter" voice)

---

### Explicitly NOT push
- Auth (OTP, password reset) — email/deep link only
- Rate-the-app prompts — in-app only
- Task-complete / day-complete / scratch reveal — user is already in-app (toasts/modals)
