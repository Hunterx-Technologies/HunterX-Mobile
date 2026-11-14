export interface DailyHealthSummary {
  date: string; // YYYY-MM-DD
  steps: number;
  calories: number; // Active calories (kcal)
  distanceKm: number;
  activeMinutes: number;
  heartRate: number; // avg or latest bpm
  sleepMinutes: number;
  workoutCount: number;
}

/** A longer period on the Metrics screen, read straight from the phone's health store. */
export type HealthRange = 'week' | 'month' | 'year';

/**
 * Totals for a period, from its first local day to now. Steps, calories,
 * distance, active minutes and workouts are totals; heart rate is the
 * period's average bpm and sleep the average per night that has sleep data.
 * dailySteps has one entry per local day of the period up to today, in order
 * (days without data are 0), for the chart.
 */
export interface RangeHealthSummary {
  range: HealthRange;
  steps: number;
  calories: number;
  distanceKm: number;
  activeMinutes: number;
  avgHeartRate: number;
  avgSleepMinutes: number;
  workoutCount: number;
  dailySteps: Array<{ date: string; steps: number }>;
}

/** YYYY-MM-DD of a Date in the device's local time (never the UTC date). */
export function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Weeks run Sunday → Saturday: local midnight of this week's Sunday (today, on a Sunday). */
export function weekStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
}

/** The 7 local days of the current week, Sunday first. */
export function currentWeekDays(now: Date = new Date()): Date[] {
  const sunday = weekStart(now);
  return Array.from({ length: 7 }, (_, i) => new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i));
}

/**
 * Where each period starts (local midnight): this week's Sunday, the 1st of
 * this month, or 1 January — the calendar period so far, matching the
 * "This week / month / year" labels.
 */
export function rangeStart(range: HealthRange, now: Date = new Date()): Date {
  if (range === 'year') return new Date(now.getFullYear(), 0, 1);
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return weekStart(now);
}

/** Every local day from `start` to `end` (inclusive), as YYYY-MM-DD. */
export function localDaysBetween(start: Date, end: Date): string[] {
  const days: string[] = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(localDateKey(d));
  }
  return days;
}

/** Active minutes as the app estimates them for one day (steps/100 + 30 per workout, max 180). */
export function estimateActiveMinutes(steps: number, workouts = 0): number {
  return Math.min(Math.round(steps / 100) + workouts * 30, 180);
}

export function emptyRangeSummary(range: HealthRange, now: Date = new Date()): RangeHealthSummary {
  return {
    range, steps: 0, calories: 0, distanceKm: 0, activeMinutes: 0, avgHeartRate: 0, avgSleepMinutes: 0, workoutCount: 0,
    dailySteps: localDaysBetween(rangeStart(range, now), now).map((date) => ({ date, steps: 0 })),
  };
}

export interface DayBarSample {
  day: string; // 'Sun', 'Mon', etc. — also the bar's key, so unique within a chart
  label: string;
  /** The bar's calendar day (YYYY-MM-DD), for daily bars — shown under the label. */
  date?: string;
  value: number; // e.g. step count or percentage 0-100
  steps: number;
  isCurrent?: boolean;
}

/**
 * Why connecting failed, so the UI can say what to do instead of "try again":
 * - unavailable: this device can't use the provider at all (e.g. HealthKit on some iPads).
 * - update_required: Android ≤13 — the Health Connect app must be installed/updated.
 * - denied: no access to Steps. On Android, after one or two refusals the
 *   permission sheet stops appearing, so access must be granted in settings.
 * - failed: anything else (the message has the details).
 */
export type HealthConnectFailure = 'unavailable' | 'update_required' | 'denied' | 'failed';

export class HealthProviderError extends Error {
  constructor(
    public readonly reason: HealthConnectFailure,
    message: string
  ) {
    super(message);
    this.name = 'HealthProviderError';
  }
}

export type HealthAvailability = 'available' | 'update_required' | 'unavailable';

export interface HealthAdapter {
  isAvailable(): Promise<boolean>;
  /** Like isAvailable, but tells "needs installing/updating" apart from "never". */
  getAvailability(): Promise<HealthAvailability>;
  /** Opens the provider's own permission settings, where a refused permission can be granted. */
  openSettings(): Promise<void>;
  requestPermissions(): Promise<boolean>;
  /**
   * Silently checks whether previously-granted permissions are still in
   * effect, without prompting the user. On Health Connect (Android) this is a
   * real, current answer. On HealthKit (iOS) Apple does not expose read-permission
   * status by design, so this can't reliably distinguish "denied" from "no
   * data" — callers should not treat a `true` result on iOS as proof of access.
   */
  checkPermissions(): Promise<boolean>;
  getTodaySummary(): Promise<DailyHealthSummary>;
  getWeekBarSamples(): Promise<DayBarSample[]>;
  /** Totals and daily steps for this week / month / year so far. Never throws; empty on failure. */
  getRangeSummary(range: HealthRange): Promise<RangeHealthSummary>;
}
