import { Platform } from 'react-native';
import { HealthProviderError, WEEKDAY_SHORT, currentWeekDays, emptyRangeSummary, estimateActiveMinutes, localDateKey, localDaysBetween, rangeStart } from './HealthAdapter';
import type { HealthAdapter, HealthAvailability, DailyHealthSummary, DayBarSample, HealthRange, RangeHealthSummary } from './HealthAdapter';
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
//
// By default Health Connect only lets an app read data from up to 30 days
// before it was first granted access. READ_HEALTH_DATA_HISTORY lifts that, so
// the Year view has the user's earlier months too. It's asked for alongside
// the rest but is optional: older Health Connect versions don't offer it, and
// without it the Year view simply starts ~30 days before connecting.

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

const HISTORY_PERMISSION = { accessType: 'read' as const, recordType: 'ReadHealthDataHistory' };

// Connected = Steps can be read. The rest are optional: a user may allow
// steps but not heart rate or sleep, and that's still a working connection
// (those cards just stay empty). Requiring all six bounced such users back
// to the connect banner on every check.
const ESSENTIAL_RECORD_TYPE = 'Steps';

type Granted = Array<{ accessType: string; recordType: string }>;

const hasEssential = (granted: unknown) =>
  Array.isArray(granted) &&
  (granted as Granted).some((g) => g.accessType === 'read' && g.recordType === ESSENTIAL_RECORD_TYPE);

const localDateStr = localDateKey;

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

/** Every record of a type in [start, end), following Health Connect's pages. */
async function readAllRecords(recordType: string, start: Date, end: Date): Promise<any[]> {
  const all: any[] = [];
  let pageToken: string | undefined;
  do {
    const res = await HealthConnect.readRecords(recordType, {
      timeRangeFilter: between(start, end),
      pageSize: 1000,
      ...(pageToken ? { pageToken } : {}),
    });
    all.push(...(res?.records ?? []));
    pageToken = res?.pageToken || undefined;
  } while (pageToken);
  return all;
}

/**
 * Steps per local day, de-duplicated, in one call. Health Connect slices by
 * the device's local calendar days; each group's startTime is a local
 * date-time ("2026-11-01T00:00"), so its first 10 characters are the day.
 */
async function dailyStepsMap(start: Date, end: Date): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const groups = await HealthConnect.aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: between(start, end),
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    });
    for (const g of groups ?? []) {
      const raw = String(g?.startTime ?? '');
      const key = /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? localDateStr(new Date(raw)) : raw.slice(0, 10);
      if (key) map.set(key, (map.get(key) || 0) + Math.round(g?.result?.COUNT_TOTAL ?? 0));
    }
  } catch (e: any) {
    devWarn('   [HealthConnect] Steps by day failed:', e?.message || e);
  }
  return map;
}

async function averageHeartRateAggregate(start: Date, end: Date): Promise<number> {
  try {
    const res = await HealthConnect.aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: between(start, end) });
    return Math.round(res?.BPM_AVG ?? 0);
  } catch (e: any) {
    devWarn('   [HealthConnect] HeartRate aggregate failed:', e?.message || e);
    return 0;
  }
}

/** Average minutes asleep per night that has a sleep session; nights keyed by the day they end on. */
async function averageSleepPerNight(start: Date, end: Date): Promise<number> {
  try {
    const byNight = new Map<string, number>();
    for (const rec of await readAllRecords('SleepSession', start, end)) {
      if (!rec.startTime || !rec.endTime) continue;
      const ms = new Date(rec.endTime).getTime() - new Date(rec.startTime).getTime();
      if (ms <= 0) continue;
      const night = localDateStr(new Date(rec.endTime));
      byNight.set(night, (byNight.get(night) || 0) + ms);
    }
    if (byNight.size === 0) return 0;
    const totalMs = [...byNight.values()].reduce((a, b) => a + b, 0);
    return Math.round(totalMs / byNight.size / 60000);
  } catch (e: any) {
    devWarn('   [HealthConnect] SleepSession read failed:', e?.message || e);
    return 0;
  }
}

async function countWorkoutsAll(start: Date, end: Date): Promise<number> {
  try {
    return (await readAllRecords('ExerciseSession', start, end)).length;
  } catch (e: any) {
    devWarn('   [HealthConnect] ExerciseSession read failed:', e?.message || e);
    return 0;
  }
}

// initialize() binds the Health Connect client. Done once and shared, instead
// of on every permission check while several reads are already in flight.
let initPromise: Promise<boolean> | null = null;

function ensureClient(): Promise<boolean> {
  if (!initPromise) {
    initPromise = Promise.resolve(HealthConnect.initialize())
      .then((ok: boolean) => {
        if (!ok) initPromise = null; // let a later call retry
        return !!ok;
      })
      .catch((e: any) => {
        initPromise = null;
        throw e;
      });
  }
  return initPromise;
}

export class HealthConnectAdapter implements HealthAdapter {
  async isAvailable(): Promise<boolean> {
    return (await this.getAvailability()) === 'available';
  }

  // Android 14+ has Health Connect built in. Android 13 and below need the
  // Health Connect app from the Play Store, and an outdated or missing app
  // reports PROVIDER_UPDATE_REQUIRED — the user can fix that by installing
  // or updating it, unlike SDK_UNAVAILABLE.
  async getAvailability(): Promise<HealthAvailability> {
    if (Platform.OS !== 'android') return 'unavailable';
    if (!HealthConnect) {
      devWarn('[HealthConnectAdapter] react-native-health-connect failed to load');
      return 'unavailable';
    }
    try {
      const status = await HealthConnect.getSdkStatus();
      devLog('[HealthConnectAdapter] SDK status:', status);
      const S = HealthConnect.SdkAvailabilityStatus ?? {};
      if (status === (S.SDK_AVAILABLE ?? 3)) return 'available';
      if (status === (S.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ?? 2)) return 'update_required';
      return 'unavailable';
    } catch (e: any) {
      devWarn('[HealthConnectAdapter] getSdkStatus failed:', e?.message || e);
      return 'unavailable';
    }
  }

  /**
   * Shows the Health Connect permission screen. True when at least Steps is
   * allowed. After the user refuses once or twice Android stops showing the
   * screen and this resolves straight away with nothing granted — the caller
   * then sends them to openSettings().
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android' || !HealthConnect) return false;
    if (!(await ensureClient())) {
      throw new HealthProviderError('failed', 'Health Connect could not be started on this device.');
    }
    // Already allowed (e.g. reconnecting): skip the permission screen.
    if (hasEssential(await HealthConnect.getGrantedPermissions())) return true;

    // History access is optional and not offered by older Health Connect
    // versions — if asking for it fails, ask again without it.
    let granted: unknown;
    try {
      granted = await HealthConnect.requestPermission([...REQUESTED_PERMISSIONS, HISTORY_PERMISSION]);
    } catch (e: any) {
      devWarn('[HealthConnectAdapter] requestPermission with history failed, retrying without:', e?.message || e);
      granted = await HealthConnect.requestPermission(REQUESTED_PERMISSIONS);
    }
    devLog('[HealthConnectAdapter] requestPermission →', JSON.stringify(granted));
    if (hasEssential(granted)) return true;
    // Some versions return only the newly granted set; check what's in effect.
    return hasEssential(await HealthConnect.getGrantedPermissions());
  }

  async openSettings(): Promise<void> {
    if (Platform.OS !== 'android' || !HealthConnect) return;
    try {
      HealthConnect.openHealthConnectSettings();
    } catch (e: any) {
      devWarn('[HealthConnectAdapter] openHealthConnectSettings failed:', e?.message || e);
    }
  }

  // Health Connect reports real, current grants (unlike HealthKit), so a
  // revoked Steps permission is detected and the store shows the connect
  // banner again instead of silently showing zeros.
  async checkPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android' || !HealthConnect) return true;
    try {
      if (!(await ensureClient())) return false;
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

  async getRangeSummary(range: HealthRange): Promise<RangeHealthSummary> {
    const now = new Date();
    const empty = emptyRangeSummary(range, now);
    if (Platform.OS !== 'android' || !HealthConnect) return empty;
    try {
      if (!(await ensureClient())) return empty;
    } catch {
      return empty;
    }

    const start = rangeStart(range, now);
    const [stepsByDay, totals, avgHeartRate, avgSleepMinutes, workouts] = await Promise.all([
      dailyStepsMap(start, now),
      aggregateTotals(start, now),
      averageHeartRateAggregate(start, now),
      // The first night ends on the period's first morning.
      averageSleepPerNight(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 18, 0), now),
      countWorkoutsAll(start, now),
    ]);

    const dailySteps = localDaysBetween(start, now).map((date) => ({ date, steps: stepsByDay.get(date) || 0 }));
    const summary: RangeHealthSummary = {
      range,
      // Prefer the whole-period aggregate; fall back to the days if it failed.
      steps: totals.steps || dailySteps.reduce((a, d) => a + d.steps, 0),
      calories: totals.calories,
      distanceKm: totals.distanceKm,
      activeMinutes: dailySteps.reduce((a, d) => a + estimateActiveMinutes(d.steps), 0) + workouts * 30,
      avgHeartRate,
      avgSleepMinutes,
      workoutCount: workouts,
      dailySteps,
    };
    devLog(`📆 [HealthConnectAdapter] ${range} summary:`, JSON.stringify({ ...summary, dailySteps: dailySteps.length }));
    return summary;
  }

  /** Sun–Sat of the current week (a new week starts empty on Sunday); each bar is that local day's de-duplicated steps. */
  async getWeekBarSamples(): Promise<DayBarSample[]> {
    const now = new Date();
    const today = startOfLocalDay(now);
    const days = currentWeekDays(now);

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
      day: WEEKDAY_SHORT[day.getDay()],
      label: WEEKDAY_SHORT[day.getDay()],
      date: localDateStr(day),
      value: Math.min(Math.round((stepsPerDay[i] / maxTarget) * 100), 100),
      steps: stepsPerDay[i],
      isCurrent: day.getTime() === today.getTime(),
    }));
    devLog('📅 [HealthConnectAdapter] Week steps:', samples.map((s) => `${s.day}:${s.steps}`).join(' '));
    return samples;
  }
}
