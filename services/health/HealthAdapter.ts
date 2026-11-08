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

export interface DayBarSample {
  day: string; // 'Mon', 'Tue', etc.
  label: string;
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
  getYesterdaySummary(): Promise<DailyHealthSummary>;
}
