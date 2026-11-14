import { Linking, Platform } from 'react-native';
import { HealthProviderError, WEEKDAY_SHORT, currentWeekDays, emptyRangeSummary, estimateActiveMinutes, localDateKey, localDaysBetween, rangeStart } from './HealthAdapter';
import type { HealthAdapter, HealthAvailability, DailyHealthSummary, DayBarSample, HealthRange, RangeHealthSummary } from './HealthAdapter';
import { devLog, devWarn } from './devLog';

// react-native-health (the old bridge-only HealthKit binding this adapter
// used to wrap) never wired up under this app's fully bridgeless New
// Architecture runtime — its native module registered but exposed zero
// methods (confirmed via a device diagnostic: NativeModules.AppleHealthKit
// existed but had no keys). @kingstinct/react-native-healthkit is built on
// Nitro Modules (JSI host objects), which work regardless of bridge/
// bridgeless mode, so it's what actually talks to HealthKit here.
let HealthKit: any = null;

try {
  if (Platform.OS === 'ios') {
    HealthKit = require('@kingstinct/react-native-healthkit');
  }
} catch (e) {
  devWarn('[AppleHealthAdapter] Could not import @kingstinct/react-native-healthkit:', e);
}

const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
] as const;

// CategoryValueSleepAnalysis: inBed = 0, awake = 2 — every other value
// (asleepUnspecified/asleepCore/asleepDeep/asleepREM) counts as actual sleep.
const SLEEP_NON_ASLEEP_VALUES = new Set([0, 2]);

// HealthKit statistics buckets are aligned to calendar days in the device's
// local timezone, but Date#toISOString() always renders in UTC — for any
// timezone ahead of UTC (e.g. IST, UTC+5:30) that pushes local midnight onto
// the previous UTC day, silently shifting every bucket by one day. Dates are
// always keyed by their local calendar day (localDateKey) instead.

export class AppleHealthAdapter implements HealthAdapter {
  private isInitialized = false;
  // One authorization request at a time. After a restart every read calls
  // ensureInitialized() and the metrics screen starts several reads at once;
  // overlapping requestAuthorization calls make HealthKit reject all but one.
  private authPromise: Promise<boolean> | null = null;

  async getAvailability(): Promise<HealthAvailability> {
    return (await this.isAvailable()) ? 'available' : 'unavailable';
  }

  // HealthKit has no API to open an app's Health permissions, so open the
  // Health app; access is under Profile → Apps → HunterX.
  async openSettings(): Promise<void> {
    try {
      await Linking.openURL('x-apple-health://');
    } catch {
      await Linking.openSettings().catch(() => {});
    }
  }

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !HealthKit) {
      return false;
    }
    try {
      if (typeof HealthKit.isHealthDataAvailableAsync === 'function') {
        return await HealthKit.isHealthDataAvailableAsync();
      }
      if (typeof HealthKit.isHealthDataAvailable === 'function') {
        return HealthKit.isHealthDataAvailable();
      }
      return false;
    } catch (e) {
      devWarn('[AppleHealthAdapter] isAvailable failed:', e);
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'ios' || !HealthKit || typeof HealthKit.requestAuthorization !== 'function') {
      return false;
    }
    if (!this.authPromise) {
      // Safe to call every time — HealthKit only shows the system prompt for
      // types not yet decided on; already-authorized types resolve silently.
      // It resolves true even when the user turns everything off (Apple hides
      // read-permission decisions), so false/throw means it couldn't ask at
      // all, e.g. the HealthKit entitlement is missing from the build.
      this.authPromise = HealthKit.requestAuthorization({ toRead: READ_TYPES })
        .then((granted: boolean) => {
          this.isInitialized = !!granted;
          return !!granted;
        })
        .catch((e: any) => {
          devWarn('[AppleHealthAdapter] requestPermissions failed:', e);
          throw new HealthProviderError(
            'failed',
            e?.message ? `Apple Health couldn't be opened: ${e.message}` : "Apple Health couldn't be opened."
          );
        })
        .finally(() => {
          this.authPromise = null;
        });
    }
    return this.authPromise!;
  }

  async checkPermissions(): Promise<boolean> {
    // HealthKit intentionally never exposes real read-permission status — see
    // the HealthAdapter interface doc. Callers should not rely on this on iOS.
    return Platform.OS === 'ios';
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.isInitialized) return true;
    // Reads fall back to empty data rather than throwing.
    return this.requestPermissions().catch(() => false);
  }

  private async sumQuantity(identifier: string, unit: string, startDate: Date, endDate: Date): Promise<number> {
    if (!HealthKit) return 0;
    try {
      const result = await HealthKit.queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
        filter: { date: { startDate, endDate } },
        unit,
      });
      return result?.sumQuantity?.quantity || 0;
    } catch (e) {
      devWarn(`[AppleHealthAdapter] sumQuantity(${identifier}) failed:`, e);
      return 0;
    }
  }

  private async averageQuantity(identifier: string, unit: string, startDate: Date, endDate: Date): Promise<number> {
    if (!HealthKit) return 0;
    try {
      const result = await HealthKit.queryStatisticsForQuantity(identifier, ['discreteAverage'], {
        filter: { date: { startDate, endDate } },
        unit,
      });
      return result?.averageQuantity?.quantity || 0;
    } catch (e) {
      devWarn(`[AppleHealthAdapter] averageQuantity(${identifier}) failed:`, e);
      return 0;
    }
  }

  private async sumSleepMinutes(startDate: Date, endDate: Date): Promise<number> {
    if (!HealthKit) return 0;
    try {
      const samples = await HealthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        filter: { date: { startDate, endDate } },
        limit: 0,
      });
      let totalMs = 0;
      (samples || []).forEach((sample: any) => {
        if (SLEEP_NON_ASLEEP_VALUES.has(sample.value)) return;
        const start = new Date(sample.startDate).getTime();
        const end = new Date(sample.endDate).getTime();
        if (end > start) totalMs += end - start;
      });
      return Math.round(totalMs / (1000 * 60));
    } catch (e) {
      devWarn('[AppleHealthAdapter] sumSleepMinutes failed:', e);
      return 0;
    }
  }

  /** Average minutes asleep per night that has sleep data, over [startDate, endDate). Nights are keyed by the day they end on. */
  private async averageSleepPerNight(startDate: Date, endDate: Date): Promise<number> {
    if (!HealthKit) return 0;
    try {
      const samples = await HealthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        filter: { date: { startDate, endDate } },
        limit: 0,
      });
      const byNight = new Map<string, number>();
      (samples || []).forEach((sample: any) => {
        if (SLEEP_NON_ASLEEP_VALUES.has(sample.value)) return;
        const start = new Date(sample.startDate).getTime();
        const end = new Date(sample.endDate);
        if (end.getTime() <= start) return;
        const night = localDateKey(end);
        byNight.set(night, (byNight.get(night) || 0) + (end.getTime() - start));
      });
      if (byNight.size === 0) return 0;
      const totalMs = [...byNight.values()].reduce((a, b) => a + b, 0);
      return Math.round(totalMs / byNight.size / 60000);
    } catch (e) {
      devWarn('[AppleHealthAdapter] averageSleepPerNight failed:', e);
      return 0;
    }
  }

  /** Steps per local day from startDate to endDate, one HealthKit query (daily buckets). */
  private async dailySteps(startDate: Date, endDate: Date): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!HealthKit) return map;
    try {
      const buckets = await HealthKit.queryStatisticsCollectionForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        startDate,
        { day: 1 },
        { filter: { date: { startDate, endDate } }, unit: 'count' }
      );
      (buckets || []).forEach((bucket: any) => {
        if (!bucket.startDate) return;
        const key = localDateKey(new Date(bucket.startDate));
        map.set(key, (map.get(key) || 0) + (bucket.sumQuantity?.quantity || 0));
      });
    } catch (e) {
      devWarn('[AppleHealthAdapter] dailySteps failed:', e);
    }
    return map;
  }

  async getRangeSummary(range: HealthRange): Promise<RangeHealthSummary> {
    const now = new Date();
    const empty = emptyRangeSummary(range, now);
    if (Platform.OS !== 'ios' || !HealthKit) return empty;
    if (!(await this.ensureInitialized())) return empty;

    const start = rangeStart(range, now);
    try {
      const [stepsByDay, calories, distanceMeters, heartRate, avgSleep, workouts] = await Promise.all([
        this.dailySteps(start, now),
        this.sumQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal', start, now),
        this.sumQuantity('HKQuantityTypeIdentifierDistanceWalkingRunning', 'm', start, now),
        this.averageQuantity('HKQuantityTypeIdentifierHeartRate', 'count/min', start, now),
        // The first night ends on the period's first morning.
        this.averageSleepPerNight(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 18, 0), now),
        this.countWorkouts(start, now),
      ]);

      const dailySteps = localDaysBetween(start, now).map((date) => ({ date, steps: Math.round(stepsByDay.get(date) || 0) }));
      const steps = dailySteps.reduce((a, d) => a + d.steps, 0);
      const summary: RangeHealthSummary = {
        range,
        steps,
        calories: Math.round(calories),
        distanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
        activeMinutes: dailySteps.reduce((a, d) => a + estimateActiveMinutes(d.steps), 0) + workouts * 30,
        avgHeartRate: Math.round(heartRate),
        avgSleepMinutes: avgSleep,
        workoutCount: workouts,
        dailySteps,
      };
      devLog(`📆 [AppleHealthAdapter] ${range} summary:`, JSON.stringify({ ...summary, dailySteps: dailySteps.length }));
      return summary;
    } catch (e) {
      devWarn('[AppleHealthAdapter] getRangeSummary failed:', e);
      return empty;
    }
  }

  private async countWorkouts(startDate: Date, endDate: Date): Promise<number> {
    if (!HealthKit) return 0;
    try {
      const workouts = await HealthKit.queryWorkoutSamples({
        filter: { date: { startDate, endDate } },
        limit: 0,
      });
      return Array.isArray(workouts) ? workouts.length : 0;
    } catch (e) {
      devWarn('[AppleHealthAdapter] countWorkouts failed:', e);
      return 0;
    }
  }

  private async summaryFor(startDate: Date, endDate: Date, dateLabel: string): Promise<DailyHealthSummary> {
    const emptySummary: DailyHealthSummary = {
      date: dateLabel,
      steps: 0,
      calories: 0,
      distanceKm: 0,
      activeMinutes: 0,
      heartRate: 0,
      sleepMinutes: 0,
      workoutCount: 0,
    };

    if (Platform.OS !== 'ios' || !HealthKit) {
      return emptySummary;
    }

    const initialized = await this.ensureInitialized();
    if (!initialized) return emptySummary;

    try {
      const [steps, calories, distanceMeters, heartRate, sleepMinutes, workoutCount] = await Promise.all([
        this.sumQuantity('HKQuantityTypeIdentifierStepCount', 'count', startDate, endDate),
        this.sumQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal', startDate, endDate),
        this.sumQuantity('HKQuantityTypeIdentifierDistanceWalkingRunning', 'm', startDate, endDate),
        this.averageQuantity('HKQuantityTypeIdentifierHeartRate', 'count/min', startDate, endDate),
        this.sumSleepMinutes(startDate, endDate),
        this.countWorkouts(startDate, endDate),
      ]);

      const activeMinutes = Math.min(Math.round(steps / 100) + workoutCount * 30, 180);

      return {
        date: dateLabel,
        steps: Math.round(steps),
        calories: Math.round(calories),
        distanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
        activeMinutes,
        heartRate: Math.round(heartRate),
        sleepMinutes,
        workoutCount,
      };
    } catch (e) {
      devWarn('[AppleHealthAdapter] summaryFor failed:', e);
      return emptySummary;
    }
  }

  async getTodaySummary(): Promise<DailyHealthSummary> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const summary = await this.summaryFor(startOfToday, now, localDateKey(now));

    devLog('----------------------------------------------------');
    devLog('📊 [AppleHealthAdapter] Today Summary from HealthKit:');
    devLog('   Date:', summary.date);
    devLog('   Steps:', summary.steps);
    devLog('   Calories (kcal):', summary.calories);
    devLog('   Distance (km):', summary.distanceKm);
    devLog('   Heart Rate (bpm):', summary.heartRate);
    devLog('   Sleep (mins):', summary.sleepMinutes);
    devLog('   Active Mins:', summary.activeMinutes);
    devLog('   Workouts:', summary.workoutCount);
    devLog('----------------------------------------------------');

    return summary;
  }

  /** Sun–Sat of the current week (a new week starts empty on Sunday); future days are 0. */
  async getWeekBarSamples(): Promise<DayBarSample[]> {
    const now = new Date();
    const weekDays = currentWeekDays(now).map((d) => ({
      dateStr: localDateKey(d),
      dayLabel: WEEKDAY_SHORT[d.getDay()],
      isCurrent: d.toDateString() === now.toDateString(),
    }));
    const startOfWeek = currentWeekDays(now)[0];

    const emptyBars: DayBarSample[] = weekDays.map((w) => ({
      day: w.dayLabel,
      label: w.dayLabel,
      date: w.dateStr,
      value: 0,
      steps: 0,
      isCurrent: w.isCurrent,
    }));

    if (Platform.OS !== 'ios' || !HealthKit) {
      return emptyBars;
    }

    const initialized = await this.ensureInitialized();
    if (!initialized) return emptyBars;

    try {
      const buckets = await HealthKit.queryStatisticsCollectionForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        startOfWeek,
        { day: 1 },
        { filter: { date: { startDate: startOfWeek, endDate: now } }, unit: 'count' }
      );

      const map: Record<string, number> = {};
      (buckets || []).forEach((bucket: any) => {
        if (!bucket.startDate) return;
        const dStr = localDateKey(new Date(bucket.startDate));
        map[dStr] = (map[dStr] || 0) + (bucket.sumQuantity?.quantity || 0);
      });

      const maxTarget = 10000;
      const bars: DayBarSample[] = weekDays.map((w) => {
        const stepVal = Math.round(map[w.dateStr] || 0);
        const pct = Math.min(Math.round((stepVal / maxTarget) * 100), 100);
        return {
          day: w.dayLabel,
          label: w.dayLabel,
          date: w.dateStr,
          value: pct,
          steps: stepVal,
          isCurrent: w.isCurrent,
        };
      });

      devLog('----------------------------------------------------');
      devLog('📅 [AppleHealthAdapter] Weekly Steps Read from HealthKit:');
      bars.forEach((b, idx) => {
        devLog(`   ${b.day} (${weekDays[idx].dateStr}): ${b.steps} steps ${b.isCurrent ? '👈 [TODAY]' : ''}`);
      });
      devLog('----------------------------------------------------');

      return bars;
    } catch (e) {
      devWarn('[AppleHealthAdapter] getWeekBarSamples failed:', e);
      return emptyBars;
    }
  }
}
