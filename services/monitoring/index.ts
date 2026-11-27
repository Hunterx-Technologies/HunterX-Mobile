import * as Sentry from '@sentry/react-native';
import { isAxiosError } from 'axios';

import { env } from '@/config/env';
import { crashlytics, crashlyticsAvailable } from './crashlytics';

/**
 * Crash and error reporting, split between two services:
 *
 *  - Firebase Crashlytics: native crashes (and JS errors as a backup). Free
 *    with no event limit, so nothing is lost if Sentry's quota runs out.
 *  - Sentry: JS errors with readable, source-mapped stack traces, plus
 *    sampled performance tracing.
 *
 * Only one SDK may own native crash handling — two crash handlers fight over
 * the same signals, mostly on iOS — so Sentry takes it only on a platform
 * where Crashlytics isn't in the build (iOS without GoogleService-Info.plist).
 *
 * Both are off in development builds unless EXPO_PUBLIC_MONITORING_IN_DEV=true;
 * reportError() only logs to the console then.
 */

// Sentry project hunterx-ltd/hunterx-mobile. A DSN is a public client key
// (it ships inside every app build), so it lives here; EXPO_PUBLIC_SENTRY_DSN
// overrides it, e.g. to point a build at a different project.
const DEFAULT_SENTRY_DSN =
  'https://b3238cf690b2d4eda32f1e1fc84437e8@o4512478946983936.ingest.us.sentry.io/4512478954979328';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || DEFAULT_SENTRY_DSN;
// Dev builds report nothing, so local debugging doesn't use up the monthly
// quota. EXPO_PUBLIC_MONITORING_IN_DEV=true turns reporting on in a dev build
// to check the setup end to end.
const ENABLED = !__DEV__ || process.env.EXPO_PUBLIC_MONITORING_IN_DEV === 'true';

const environment = __DEV__
  ? 'development'
  : /^https:\/\/api\.hunterx\.co\.in(\/|$)/.test(env.apiUrl)
    ? 'production'
    : 'uat';

// Errors that say "the network was bad", not "the app is broken". They'd eat
// Sentry's monthly quota without anything to fix.
const IGNORED_ERRORS = [
  'Network Error',
  'Network request failed',
  /timeout of \d+ms exceeded/,
  'Request aborted',
  'canceled',
];

function isExpectedApiError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  // No response = offline/timeout; 4xx = the server rejected the request on
  // purpose (validation, auth, not found). Only 5xx is worth a report.
  const status = error.response?.status;
  return status === undefined || status < 500;
}

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

let initialized = false;

export function initMonitoring() {
  if (initialized) return;
  initialized = true;

  crashlytics.init(ENABLED);

  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: ENABLED && !!SENTRY_DSN,
    environment,
    enableNativeCrashHandling: !crashlyticsAvailable,
    // Performance: every trace in a dev build (only sent when checking the
    // setup), 10% in release builds to keep the span quota low.
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    // Structured logs via Sentry.logger, linked to the errors around them.
    enableLogs: true,
    // Session Replay, only for sessions that hit an error, so each report
    // comes with a recording of the moments before it. All text, images and
    // vectors are masked: Metrics shows health data, which must never leave
    // the phone in readable form.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      navigationIntegration,
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
        maskAllVectors: true,
      }),
    ],
    ignoreErrors: IGNORED_ERRORS,
    sendDefaultPii: false,
    beforeSend(event, hint) {
      if (isExpectedApiError(hint.originalException)) return null;
      return event;
    },
  });
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}

/**
 * Report an error the app caught and handled (error boundaries, try/catch).
 * Uncaught errors and crashes are picked up automatically — no need to call
 * this for them. `context` shows up as tags in Sentry and a log line in
 * Crashlytics; keep it to short, non-personal values.
 */
export function reportError(error: unknown, context: Record<string, string> = {}) {
  if (!ENABLED) {
    console.warn('[monitoring] reportError', error, context);
    return;
  }
  if (isExpectedApiError(error)) return;

  const err = toError(error);
  Sentry.captureException(err, { tags: context });
  if (Object.keys(context).length) crashlytics.log(JSON.stringify(context));
  crashlytics.recordError(err);
}

/** A trail of what the user did before an error, attached to the next report. */
export function addBreadcrumb(message: string) {
  if (!ENABLED) return;
  Sentry.addBreadcrumb({ message });
  crashlytics.log(message);
}

/** Tag reports with the signed-in user's ID only — never email or name. */
export function setMonitoringUser(user: { id: string } | null) {
  if (!ENABLED) return;
  Sentry.setUser(user ? { id: user.id } : null);
  crashlytics.setUser(user?.id ?? null);
}

export const wrapRoot = Sentry.wrap;
