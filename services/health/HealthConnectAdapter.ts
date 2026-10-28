import { Platform } from 'react-native';
import type { HealthAdapter, DailyHealthSummary, DayBarSample } from './HealthAdapter';
import { devLog, devWarn } from './devLog';

// Android health data via Health Connect. Google Fit, Samsung Health, the
// phone's own pedometer and watches all write into Health Connect, so this
// one source covers them.
//
// Totals (steps, distance, active calories) use aggregateRecord, which
// de-duplicates overlapping data from several apps by the user's source
// priority. Summing raw records instead counts the same walk once per app
// that logged it (e.g. Google Fit + the phone), inflating the numbers.
//
// Days are the user's local calendar days (local midnight to midnight), never
// UTC dates — toISOString().split('T')[0] would put early-morning steps on the
// wrong day and shift every bar of the weekly chart back a day east of UTC.
//
// The manifest must declare each android.permission.health.READ_* permission
// (app.json → android.permissions); Health Connect refuses anything undeclared.

let HealthConnect: any = null;

try {
  if (Platform.OS === 'android') {
    HealthConnect = require('react-native-health-connect');
  }
} catch (e) {
  devWarn('[HealthConnectAdapter] Could not import react-native-health-connect:', e);
}

const REQUESTED_PERMISSIONS: Array<{ accessType: 'read'; recordType: string }> = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ExerciseSession' },
];

// Connected = Steps can be read. The rest are optional: a user may allow
// steps but not heart rate or sleep, and that's still a working connection
// (those cards just stay empty). Requiring all six bounced such users back
// to the connect banner on every check.
const ESSENTIAL_RECORD_TYPE = 'Steps';

type Granted = Array<{ accessType: string; recordType: string }>;

const hasEssential = (granted: unknown) =>
  Array.isArray(granted) &&
  (granted as Granted).some((g) => g.accessType === 'read' && g.recordType === ESSENTIAL_RECORD_TYPE);

/** YYYY-MM-DD of a Date in the device's local time. */
function localDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const between = (start: Date, end: Date) => ({
  operator: 'between' as const,
  startTime: start.toISOString(),
  endTime: end.toISOString(),
});

function emptySummary(date: string): DailyHealthSummary {
  return { date, steps: 0, calories: 0, distanceKm: 0, activeMinutes: 0, heartRate: 0, sleepMinutes: 0, workoutCount: 0 };
}

/** De-duplicated totals for [start, end). Each metric fails on its own (e.g. not permitted → 0). */
async function aggregateTotals(start: Date, end: Date) {
  const timeRangeFilter = between(start, end);

  let steps = 0;
  try {
    const res = await HealthConnect.aggregateRecord({ recordType: 'Steps', timeRangeFilter });
    steps = Math.round(res?.COUNT_TOTAL ?? 0);
  } catch (e: any) {
    devWarn('   [HealthConnect] Steps aggregate failed:', e?.message || e);
  }

  let calories = 0;
  try {
    const res = await HealthConnect.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter });
    calories = Math.round(res?.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0);
  } catch (e: any) {
    devWarn('   [HealthConnect] ActiveCaloriesBurned aggregate failed:', e?.message || e);
  }

  let distanceKm = 0;
  try {
    const res = await HealthConnect.aggregateRecord({ recordType: 'Distance', timeRangeFilter });
    distanceKm = parseFloat(((res?.DISTANCE?.inMeters ?? 0) / 1000).toFixed(2));
  } catch (e: any) {
    devWarn('   [HealthConnect] Distance aggregate failed:', e?.message || e);
  }

  return { steps, calories, distanceKm };
}

async function averageHeartRate(start: Date, end: Date): Promise<number> {
  try {
    const res = await HealthConnect.readRecords('HeartRate', { timeRangeFilter: between(start, end) });
    let sum = 0;
    let count = 0;
    for (const rec of res?.records ?? []) {
      for (const s of rec.samples ?? []) {
        sum += s.beatsPerMinute || 0;
        count++;
      }
    }
    return count > 0 ? Math.round(sum / count) : 0;
  } catch (e: any) {
    devWarn('   [HealthConnect] HeartRate read failed:', e?.message || e);
    return 0;
  }
}

/** Minutes asleep in sessions overlapping [start, end) — the night leading into the day. */
async function sleepMinutes(start: Date, end: Date): Promise<number> {
  try {
    const res = await HealthConnect.readRecords('SleepSession', { timeRangeFilter: between(start, end) });
    let totalMs = 0;
    for (const rec of res?.records ?? []) {
      if (rec.startTime && rec.endTime) totalMs += new Date(rec.endTime).getTime() - new Date(rec.startTime).getTime();
    }
    return Math.round(totalMs / 60000);
  } catch (e: any) {
    devWarn('   [HealthConnect] SleepSession read failed:', e?.message || e);
    return 0;
  }
}

async function workoutCount(start: Date, end: Date): Promise<number> {
  try {
    const res = await HealthConnect.readRecords('ExerciseSession', { timeRangeFilter: between(start, end) });
    return res?.records?.length ?? 0;
  } catch (e: any) {
    devWarn('   [HealthConnect] ExerciseSession read failed:', e?.message || e);
    return 0;
  }
}

/** One local day: [dayStart, dayEnd), with sleep from 18:00 the evening before. */
async function summarizeDay(dayStart: Date, dayEnd: Date): Promise<DailyHealthSummary> {
  const date = localDateStr(dayStart);
  if (Platform.OS !== 'android' || !HealthConnect) return emptySummary(date);

  const sleepFrom = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() - 1, 18, 0);
  const [totals, heartRate, sleep, workouts] = await Promise.all([
    aggregateTotals(dayStart, dayEnd),
    averageHeartRate(dayStart, dayEnd),
    sleepMinutes(sleepFrom, dayEnd),
    workoutCount(dayStart, dayEnd),
  ]);

  const summary: DailyHealthSummary = {
    date,
    ...totals,
    heartRate,
    sleepMinutes: sleep,
    workoutCount: workouts,
    activeMinutes: Math.min(Math.round(totals.steps / 100) + workouts * 30, 180),
  };
  devLog('📊 [HealthConnectAdapter] Day summary:', JSON.stringify(summary));
  return summary;
}

export class HealthConnectAdapter implements HealthAdapter {
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!HealthConnect) {
      console.error('[HealthConnectAdapter] react-native-health-connect failed to load');
      return false;
    }
    try {
      const status = await HealthConnect.getSdkStatus();
      devLog('[HealthConnectAdapter] SDK status:', status);
      return status === HealthConnect.SdkAvailabilityStatus?.SDK_AVAILABLE;
    } catch (e: any) {
      console.error('[HealthConnectAdapter] getSdkStatus failed:', e?.message || e);
      return false;
    }
  }

  /** Shows the Health Connect permission screen. True when at least Steps was allowed. */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android' || !HealthConnect) return false;
    try {
      if (!(await HealthConnect.initialize())) {
        console.error('[HealthConnectAdapter] initialize() returned false');
        return false;
      }
      const granted = await HealthConnect.requestPermission(REQUESTED_PERMISSIONS);
      devLog('[HealthConnectAdapter] requestPermission →', JSON.stringify(granted));
      if (hasEssential(granted)) return true;
      // Some versions return only the newly granted set; check what's in effect.
      return hasEssential(await HealthConnect.getGrantedPermissions());
    } catch (e: any) {
      console.error('[HealthConnectAdapter] requestPermissions failed:', e?.message || e);
      return false;
    }
  }

  // Health Connect reports real, current grants (unlike HealthKit), so a
  // revoked Steps permission is detected and the store shows the connect
  // banner again instead of silently showing zeros.
  async checkPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android' || !HealthConnect) return true;
    try {
      if (!(await HealthConnect.initialize())) return false;
      return hasEssential(await HealthConnect.getGrantedPermissions());
    } catch (e: any) {
      devWarn('[HealthConnectAdapter] checkPermissions failed:', e?.message || e);
      return true;
    }
  }

  async getTodaySummary(): Promise<DailyHealthSummary> {
    const now = new Date();
    return summarizeDay(startOfLocalDay(now), now);
  }

  async getYesterdaySummary(): Promise<DailyHealthSummary> {
    const today = startOfLocalDay(new Date());
    return summarizeDay(addDays(today, -1), today);
  }

  /** Mon–Sun of the current week; each bar is that local day's de-duplicated steps. */
  async getWeekBarSamples(): Promise<DayBarSample[]> {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const today = startOfLocalDay(now);
    const monday = addDays(today, now.getDay() === 0 ? -6 : 1 - now.getDay());
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

    const stepsPerDay = await Promise.all(
      days.map(async (day) => {
        if (Platform.OS !== 'android' || !HealthConnect || day > today) return 0;
        const end = day.getTime() === today.getTime() ? now : addDays(day, 1);
        try {
          const res = await HealthConnect.aggregateRecord({ recordType: 'Steps', timeRangeFilter: between(day, end) });
          return Math.round(res?.COUNT_TOTAL ?? 0);
        } catch (e: any) {
          devWarn(`   [HealthConnect] Steps aggregate for ${localDateStr(day)} failed:`, e?.message || e);
          return 0;
        }
      })
    );

    const maxTarget = 10000;
    const samples = days.map((day, i) => ({
      day: dayNames[day.getDay()],
      label: dayNames[day.getDay()],
      value: Math.min(Math.round((stepsPerDay[i] / maxTarget) * 100), 100),
      steps: stepsPerDay[i],
      isCurrent: day.getTime() === today.getTime(),
    }));
    devLog('📅 [HealthConnectAdapter] Week steps:', samples.map((s) => `${s.day}:${s.steps}`).join(' '));
    return samples;
  }
}
