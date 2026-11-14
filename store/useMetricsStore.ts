import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { healthService, getAdapterForProvider } from '@/services/health/healthService';
import { devLog, devWarn } from '@/services/health/devLog';
import { HealthProviderError } from '@/services/health/HealthAdapter';
import { WEEKDAY_SHORT, currentWeekDays, localDateKey, rangeStart } from '@/services/health/HealthAdapter';
import type { RangeHealthSummary } from '@/services/health/HealthAdapter';

const HEALTH_STORAGE_KEY = '@hunterx_health_sync_state';
// Left by older versions, which also uploaded daily totals to the server
// (throttled with this timestamp). Health data is now only read on the
// phone; the key is just cleared.
const LEGACY_SYNC_TIME_KEY = '@hunterx_last_health_sync_time';

const ALL_RANGES: TimeRange[] = ['Today', 'Week', 'Month', 'Year'];
const DAILY_STEP_GOAL = 10000;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type TimeRange = 'Today' | 'Week' | 'Month' | 'Year';

export interface MetricDetail {
  value: string;
  unit: string;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  target?: string;
  progress?: number;
}

export interface DayBarData {
  day: string;
  label: string;
  value: number; // 0 to 100 percentage
  steps?: number;
  isCurrent?: boolean;
  /** YYYY-MM-DD, for daily bars (Week); shown under the day name. */
  date?: string;
}

export interface MetricsDataset {
  steps: {
    current: number;
    target: number;
    percentage: number;
  };
  calories: MetricDetail;
  distance: MetricDetail;
  activeMinutes: MetricDetail;
  heartRate: MetricDetail;
  sleep: MetricDetail;
  workouts: MetricDetail;
  weeklyActivity: {
    avgSteps: string;
    days: DayBarData[];
    /** False until the phone's health store has been read for this period (the chart shows a loader). */
    loaded: boolean;
    /** First day of the period (YYYY-MM-DD). */
    periodStart: string;
    /** First day in the period with any steps, or null if none — "Recorded since …". */
    firstDataDate: string | null;
  };
}

export interface MetricsState {
  timeRange: TimeRange;
  availableRanges: TimeRange[];
  isHealthConnected: boolean;
  connectedProvider: 'apple_health' | 'health_connect' | null;
  lastSyncedText: string;
  isSyncing: boolean;
  isLoadingRangeData: boolean;
  isLoaded: boolean;

  // Datasets per time range
  datasets: Record<TimeRange, MetricsDataset>;

  setTimeRange: (range: TimeRange) => void;
  connectProvider: (provider: 'apple_health' | 'health_connect') => Promise<void>;
  disconnectProvider: () => void;
  verifyProviderAccess: () => Promise<boolean>;
  /** Re-reads today (and the selected period) from the phone's health store. */
  syncNow: () => Promise<void>;
  fetchTodayLiveMetrics: () => Promise<void>;
  /** Reads a period's totals and chart from the phone's health store. */
  fetchRangeData: (range: TimeRange) => Promise<void>;
  initFromStorage: () => Promise<void>;
}

function formatSleepMinutes(mins: number): string {
  if (!mins || mins <= 0) return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function formatNumberWithCommas(num: number): string {
  return (num || 0).toLocaleString('en-US');
}

const pctOf = (value: number, target: number) => (target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0);

/**
 * The chart bars for a period, from its daily steps:
 *  Week  — Sun…Sat of this week (days still to come are empty; Sunday starts a new week)
 *  Month — the month's weeks: 1–7, 8–14, 15–21, 22–28, 29–end
 *  Year  — Jan…Dec
 * Each bar's fill is its steps against the daily goal × the days it covers.
 */
function buildBars(range: 'Week' | 'Month' | 'Year', dailySteps: RangeHealthSummary['dailySteps'], now: Date): DayBarData[] {
  const byDate = new Map(dailySteps.map((d) => [d.date, d.steps]));
  const stepsOn = (d: Date) => byDate.get(localDateKey(d)) || 0;

  if (range === 'Week') return emptyOrFilledWeek(now, stepsOn);

  if (range === 'Month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const bars: DayBarData[] = [];
    for (let first = 1; first <= daysInMonth; first += 7) {
      const last = Math.min(first + 6, daysInMonth);
      let steps = 0;
      for (let day = first; day <= last; day++) steps += stepsOn(new Date(y, m, day));
      const label = first === last ? `${first}` : `${first}–${last}`;
      bars.push({
        day: label,
        label,
        steps,
        value: pctOf(steps, DAILY_STEP_GOAL * (last - first + 1)),
        isCurrent: now.getDate() >= first && now.getDate() <= last,
      });
    }
    return bars;
  }

  const y = now.getFullYear();
  return MONTH_NAMES.map((name, m) => {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let steps = 0;
    for (let day = 1; day <= daysInMonth; day++) steps += stepsOn(new Date(y, m, day));
    return { day: name, label: name, steps, value: pctOf(steps, DAILY_STEP_GOAL * daysInMonth), isCurrent: m === now.getMonth() };
  });
}

/** Sun–Sat bars for the current week, each with its date. */
function emptyOrFilledWeek(now: Date, stepsOn: (d: Date) => number = () => 0): DayBarData[] {
  return currentWeekDays(now).map((d) => {
    const name = WEEKDAY_SHORT[d.getDay()];
    const steps = stepsOn(d);
    return {
      day: name,
      label: name,
      date: localDateKey(d),
      steps,
      value: pctOf(steps, DAILY_STEP_GOAL),
      isCurrent: d.toDateString() === now.toDateString(),
    };
  });
}

function notLoaded(range: 'week' | 'month' | 'year') {
  return { loaded: false, periodStart: localDateKey(rangeStart(range)), firstDataDate: null };
}

/** First day with any steps, or null. */
function firstDayWithSteps(days: Array<{ date?: string; steps?: number }>): string | null {
  return days.find((d) => (d.steps || 0) > 0 && d.date)?.date ?? null;
}

/** Days of the current week so far, today included (1 on Sunday … 7 on Saturday). */
function weekDaysSoFar(now: Date): number {
  return now.getDay() + 1;
}

/** The whole period's step goal: the daily goal × every day in the week / month / year. */
function periodStepTarget(range: 'Week' | 'Month' | 'Year', now: Date): number {
  if (range === 'Week') return DAILY_STEP_GOAL * 7;
  if (range === 'Month') return DAILY_STEP_GOAL * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const y = now.getFullYear();
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return DAILY_STEP_GOAL * (isLeap ? 366 : 365);
}

// The provider a stored connection is actually usable with on this install.
// iOS can only ever drive Apple Health; Android can only ever drive Health
// Connect — there's no cross-platform provider.
function getPlatformProvider(): 'apple_health' | 'health_connect' | null {
  if (Platform.OS === 'ios') return 'apple_health';
  if (Platform.OS === 'android') return 'health_connect';
  return null;
}

interface StoredConnectionState {
  isHealthConnected: boolean;
  connectedProvider: 'apple_health' | 'health_connect' | null;
  lastSyncedText: string;
}

const DISCONNECTED_STATE: StoredConnectionState = {
  isHealthConnected: false,
  connectedProvider: null,
  lastSyncedText: 'Not connected',
};

// Reconciles the persisted connection flag against the platform we're actually
// running on. A provider connected on the other OS (e.g. Apple Health state
// left over from an iOS install of this same app, now reinstalled/running on
// Android, or vice versa) can never be queried here — AppleHealthAdapter and
// HealthConnectAdapter both hard no-op outside their own platform — so instead
// of silently returning zeros forever, we treat it as disconnected and signal
// that the stale record should be wiped, which re-surfaces the connect banner
// so the user is prompted to link the provider that actually matches this device.
function resolveStoredConnectionState(json: string | null): {
  state: StoredConnectionState;
  shouldClearStorage: boolean;
} {
  if (!json) {
    return { state: DISCONNECTED_STATE, shouldClearStorage: false };
  }
  try {
    const parsed = JSON.parse(json);
    const storedProvider: 'apple_health' | 'health_connect' | null = parsed.connectedProvider || null;
    const wasConnected = !!parsed.isHealthConnected;

    if (!wasConnected || !storedProvider) {
      return { state: DISCONNECTED_STATE, shouldClearStorage: false };
    }

    if (storedProvider !== getPlatformProvider()) {
      return { state: DISCONNECTED_STATE, shouldClearStorage: true };
    }

    return {
      state: {
        isHealthConnected: true,
        connectedProvider: storedProvider,
        lastSyncedText: parsed.lastSyncedText || 'Not connected',
      },
      shouldClearStorage: false,
    };
  } catch (_) {
    return { state: DISCONNECTED_STATE, shouldClearStorage: false };
  }
}

const DEFAULT_DATASETS: Record<TimeRange, MetricsDataset> = {
  Today: {
    steps: { current: 0, target: 10000, percentage: 0 },
    calories: { value: '0', unit: 'kcal', trend: 'Live today', trendDirection: 'neutral' },
    distance: { value: '0.0', unit: 'km', trend: 'Live today', trendDirection: 'neutral' },
    activeMinutes: { value: '0', unit: 'min', trend: 'Live today', trendDirection: 'neutral' },
    heartRate: { value: '0', unit: 'bpm', trend: 'Live today', trendDirection: 'neutral' },
    sleep: { value: '0h 0m', unit: '', trend: 'Last night', trendDirection: 'neutral' },
    workouts: { value: '0', unit: 'session', trend: 'Live today', trendDirection: 'neutral' },
    weeklyActivity: {
      avgSteps: '0',
      days: emptyOrFilledWeek(new Date()),
      ...notLoaded('week'),
    },
  },
  Week: {
    steps: { current: 0, target: 70000, percentage: 0 },
    calories: { value: '0', unit: 'kcal', trend: 'This week', trendDirection: 'neutral' },
    distance: { value: '0.0', unit: 'km', trend: 'This week', trendDirection: 'neutral' },
    activeMinutes: { value: '0', unit: 'min', trend: 'This week', trendDirection: 'neutral' },
    heartRate: { value: '0', unit: 'bpm avg', trend: 'This week', trendDirection: 'neutral' },
    sleep: { value: '0h 0m', unit: 'avg', trend: 'This week', trendDirection: 'neutral' },
    workouts: { value: '0', unit: 'sessions', trend: 'This week', trendDirection: 'neutral' },
    weeklyActivity: {
      avgSteps: '0',
      days: emptyOrFilledWeek(new Date()),
      ...notLoaded('week'),
    },
  },
  Month: {
    steps: { current: 0, target: 300000, percentage: 0 },
    calories: { value: '0', unit: 'kcal', trend: 'This month', trendDirection: 'neutral' },
    distance: { value: '0.0', unit: 'km', trend: 'This month', trendDirection: 'neutral' },
    activeMinutes: { value: '0', unit: 'min', trend: 'This month', trendDirection: 'neutral' },
    heartRate: { value: '0', unit: 'bpm avg', trend: 'This month', trendDirection: 'neutral' },
    sleep: { value: '0h 0m', unit: 'avg', trend: 'This month', trendDirection: 'neutral' },
    workouts: { value: '0', unit: 'sessions', trend: 'This month', trendDirection: 'neutral' },
    weeklyActivity: {
      avgSteps: '0',
      days: buildBars('Month', [], new Date()),
      ...notLoaded('month'),
    },
  },
  Year: {
    steps: { current: 0, target: 3650000, percentage: 0 },
    calories: { value: '0', unit: 'kcal', trend: 'This year', trendDirection: 'neutral' },
    distance: { value: '0.0', unit: 'km', trend: 'This year', trendDirection: 'neutral' },
    activeMinutes: { value: '0', unit: 'min', trend: 'This year', trendDirection: 'neutral' },
    heartRate: { value: '0', unit: 'bpm avg', trend: 'This year', trendDirection: 'neutral' },
    sleep: { value: '0h 0m', unit: 'avg', trend: 'This year', trendDirection: 'neutral' },
    workouts: { value: '0', unit: 'sessions', trend: 'This year', trendDirection: 'neutral' },
    weeklyActivity: {
      avgSteps: '0',
      days: buildBars('Year', [], new Date()),
      ...notLoaded('year'),
    },
  },
};

// Connecting, focusing the Metrics screen and the app becoming active (e.g.
// returning from the permission screen) each start the same fetch/sync, so
// they used to overlap: 30+ simultaneous Health Connect calls, or several
// HealthKit authorization requests at once. A call that's already running is
// shared instead of started again.
const inFlight: Record<string, Promise<void> | undefined> = {};
function singleFlight(key: string, run: () => Promise<void>): Promise<void> {
  const running = inFlight[key];
  if (running) return running;
  const p = run().finally(() => {
    inFlight[key] = undefined;
  });
  inFlight[key] = p;
  return p;
}

export const useMetricsStore = create<MetricsState>((set, get) => {
  // Immediately read persisted connection state on store initialization
  AsyncStorage.getItem(HEALTH_STORAGE_KEY)
    .then((json) => {
      const { state, shouldClearStorage } = resolveStoredConnectionState(json);
      set({ ...state, isLoaded: true });
      if (shouldClearStorage) {
        // Stored connection belongs to the other platform's provider — drop it
        // (and any sync throttle timestamp) so a fresh connect isn't held back.
        AsyncStorage.multiRemove([HEALTH_STORAGE_KEY, LEGACY_SYNC_TIME_KEY]).catch(() => {});
      }
    })
    .catch(() => {
      set({ isLoaded: true });
    });
  AsyncStorage.removeItem(LEGACY_SYNC_TIME_KEY).catch(() => {});

  // Persists a fresh "Last synced" text alongside the current connection
  // state. Without this, lastSyncedText only ever lived in memory — the next
  // app launch's initFromStorage() would overwrite it with whatever was last
  // written at connect time, showing a stale sync time forever.
  const persistLastSyncedText = async (lastSyncedText: string) => {
    await AsyncStorage.setItem(
      HEALTH_STORAGE_KEY,
      JSON.stringify({
        isHealthConnected: get().isHealthConnected,
        connectedProvider: get().connectedProvider,
        lastSyncedText,
      })
    ).catch(() => {});
  };

  // A failed read still ends the loader; the chart then shows its empty state.
  const markLoaded = (range: TimeRange) =>
    set((state) => ({
      datasets: {
        ...state.datasets,
        [range]: { ...state.datasets[range], weeklyActivity: { ...state.datasets[range].weeklyActivity, loaded: true } },
      },
    }));

  return {
    timeRange: 'Today',
    availableRanges: ALL_RANGES,
    isHealthConnected: false,
    connectedProvider: null,
    lastSyncedText: 'Not connected',
    isSyncing: false,
    isLoadingRangeData: false,
    isLoaded: false,
    datasets: DEFAULT_DATASETS,

    setTimeRange: (range: TimeRange) => {
      set({ timeRange: range });
      if (range === 'Today') {
        get().fetchTodayLiveMetrics();
      } else {
        get().fetchRangeData(range);
      }
    },

    initFromStorage: async () => {
      try {
        const json = await AsyncStorage.getItem(HEALTH_STORAGE_KEY);
        const { state, shouldClearStorage } = resolveStoredConnectionState(json);
        devLog('====================================================');
        devLog('💾 [useMetricsStore] Resolved stored connection state:');
        devLog('   isHealthConnected:', state.isHealthConnected);
        devLog('   connectedProvider:', state.connectedProvider);
        devLog('   lastSyncedText:', state.lastSyncedText);
        devLog('   shouldClearStorage:', shouldClearStorage);
        devLog('====================================================');
        set({ ...state, isLoaded: true });
        if (shouldClearStorage) {
          await AsyncStorage.multiRemove([HEALTH_STORAGE_KEY, LEGACY_SYNC_TIME_KEY]).catch(() => {});
        }
      } catch (_) {
        set({ isLoaded: true });
      }
    },

    connectProvider: async (provider: 'apple_health' | 'health_connect') => {
      devLog('[useMetricsStore] connectProvider called for:', provider);

      if (provider === 'apple_health' && Platform.OS !== 'ios') {
        throw new Error('Apple Health (HealthKit) is only available on iOS devices.');
      }

      if (provider === 'health_connect' && Platform.OS !== 'android') {
        throw new Error('Google Fit / Health Connect is only available on Android devices.');
      }

      set({ isSyncing: true });
      try {
        const adapter = getAdapterForProvider(provider);
        devLog('[useMetricsStore] Got adapter for provider:', adapter?.constructor?.name);
        const availability = await adapter.getAvailability();
        devLog('[useMetricsStore] adapter.getAvailability() returned:', availability);
        if (availability === 'update_required') {
          throw new HealthProviderError(
            'update_required',
            'Health Connect needs to be installed or updated from the Play Store.'
          );
        }
        if (availability !== 'available') {
          throw new HealthProviderError(
            'unavailable',
            provider === 'apple_health'
              ? 'Apple Health is not available on this device.'
              : 'Health Connect is not available on this device.'
          );
        }

        devLog('[useMetricsStore] Requesting permissions via adapter...');
        let granted: boolean;
        try {
          granted = await adapter.requestPermissions();
        } catch (e) {
          if (e instanceof HealthProviderError) throw e;
          throw new HealthProviderError('failed', (e as Error)?.message || 'Could not request health permissions.');
        }
        devLog('[useMetricsStore] adapter.requestPermissions() returned:', granted);
        if (!granted) {
          throw new HealthProviderError(
            'denied',
            provider === 'apple_health'
              ? 'HunterX was not given access to Apple Health.'
              : 'HunterX needs permission to read your steps in Health Connect.'
          );
        }

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newState = {
          isHealthConnected: true,
          connectedProvider: provider,
          lastSyncedText: `Today, ${timeString}`,
          isSyncing: false,
        };

        set(newState);
        await AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(newState));

        // Read today's numbers straight away. Access is granted at this point,
        // so a hiccup here must not turn a successful connection into a
        // "Connection Failed" alert.
        await get().fetchTodayLiveMetrics().catch(() => {});
      } catch (e) {
        set({ isSyncing: false });
        throw e;
      }
    },

    disconnectProvider: () => {
      const newState = {
        isHealthConnected: false,
        connectedProvider: null,
        lastSyncedText: 'Not connected',
      };
      set({ ...newState, timeRange: 'Today', datasets: DEFAULT_DATASETS });
      AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(newState)).catch(() => {});
    },

    // Health Connect (Android) exposes real, current permission-grant status,
    // so we can detect an actual revocation and bounce back to the connect
    // banner instead of silently showing stale/zero data forever. HealthKit
    // (iOS) does not expose this for read permissions by design — Apple's
    // API intentionally can't distinguish "denied" from "no data" — so on iOS
    // this is a deliberate no-op and the existing empty-state handling stands.
    verifyProviderAccess: async () => {
      const { isHealthConnected, connectedProvider } = get();
      if (!isHealthConnected || connectedProvider !== 'health_connect') {
        return true;
      }
      const adapter = getAdapterForProvider(connectedProvider);
      const stillGranted = await adapter.checkPermissions();
      if (!stillGranted) {
        get().disconnectProvider();
        return false;
      }
      return true;
    },

    syncNow: () =>
      singleFlight('syncNow', async () => {
      if (!get().isHealthConnected) return;
      if (!(await get().verifyProviderAccess())) return;

      set({ isSyncing: true });
      try {
        const range = get().timeRange;
        await Promise.all([
          get().fetchTodayLiveMetrics(),
          range !== 'Today' ? get().fetchRangeData(range) : Promise.resolve(),
        ]);
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const lastSyncedText = `Today, ${timeString}`;
        set({ lastSyncedText, isSyncing: false });
        await persistLastSyncedText(lastSyncedText);
      } catch (e) {
        set({ isSyncing: false });
      }
      }),

    fetchTodayLiveMetrics: () =>
      singleFlight('fetchTodayLiveMetrics', async () => {
      if (!get().isHealthConnected) return;
      if (!(await get().verifyProviderAccess())) return;

      try {
        const adapter = get().connectedProvider ? getAdapterForProvider(get().connectedProvider!) : healthService;
        const [todaySummary, weekBars] = await Promise.all([
          adapter.getTodaySummary(),
          adapter.getWeekBarSamples(),
        ]);

        const stepsCurrent = todaySummary.steps || 0;
        const stepsTarget = 10000;
        const stepsPct = Math.min(Math.round((stepsCurrent / stepsTarget) * 100), 100);

        // Average over the days of this week so far (Sunday counts as day 1),
        // not all 7 — days still to come would drag it down.
        const totalWeekSteps = weekBars.reduce((acc, curr) => acc + (curr.steps || 0), 0);
        const avgWeekSteps = Math.round(totalWeekSteps / weekDaysSoFar(new Date()));

        set((state) => ({
          datasets: {
            ...state.datasets,
            Today: {
              steps: {
                current: stepsCurrent,
                target: stepsTarget,
                percentage: stepsPct,
              },
              calories: {
                value: formatNumberWithCommas(todaySummary.calories),
                unit: 'kcal',
                trend: 'Live today',
                trendDirection: 'neutral',
              },
              distance: {
                value: (todaySummary.distanceKm || 0).toFixed(1),
                unit: 'km',
                trend: 'Live today',
                trendDirection: 'neutral',
              },
              activeMinutes: {
                value: `${todaySummary.activeMinutes || 0}`,
                unit: 'min',
                trend: 'Live today',
                trendDirection: 'neutral',
              },
              heartRate: {
                value: `${todaySummary.heartRate || 0}`,
                unit: 'bpm',
                trend: 'Live today',
                trendDirection: 'neutral',
              },
              sleep: {
                value: formatSleepMinutes(todaySummary.sleepMinutes),
                unit: '',
                trend: 'Last night',
                trendDirection: 'neutral',
              },
              workouts: {
                value: `${todaySummary.workoutCount || 0}`,
                unit: todaySummary.workoutCount === 1 ? 'session' : 'sessions',
                trend: 'Live today',
                trendDirection: 'neutral',
              },
              weeklyActivity: {
                avgSteps: formatNumberWithCommas(avgWeekSteps),
                days: weekBars,
                loaded: true,
                periodStart: localDateKey(rangeStart('week')),
                firstDataDate: firstDayWithSteps(weekBars),
              },
            },
          },
        }));
      } catch (e) {
        devWarn('[useMetricsStore] fetchTodayLiveMetrics failed:', e);
        markLoaded('Today');
      }
      }),

    fetchRangeData: (range: TimeRange) =>
      singleFlight(`range:${range}`, async () => {
      if (range === 'Today') return get().fetchTodayLiveMetrics();
      if (!get().isHealthConnected) return;
      if (!(await get().verifyProviderAccess())) return;

      set({ isLoadingRangeData: true });
      try {
        const adapter = get().connectedProvider ? getAdapterForProvider(get().connectedProvider!) : healthService;
        const apiRange = range.toLowerCase() as 'week' | 'month' | 'year';
        const summary = await adapter.getRangeSummary(apiRange);
        const now = new Date();

        const stepsTarget = periodStepTarget(range, now);
        const daysSoFar = summary.dailySteps.length || 1;
        const period = `This ${range.toLowerCase()}`;

        set((state) => ({
          isLoadingRangeData: false,
          datasets: {
            ...state.datasets,
            [range]: {
              steps: { current: summary.steps, target: stepsTarget, percentage: pctOf(summary.steps, stepsTarget) },
              calories: { value: formatNumberWithCommas(summary.calories), unit: 'kcal', trend: period, trendDirection: 'neutral' },
              distance: { value: (summary.distanceKm || 0).toFixed(1), unit: 'km', trend: period, trendDirection: 'neutral' },
              activeMinutes: { value: formatNumberWithCommas(summary.activeMinutes), unit: 'min', trend: period, trendDirection: 'neutral' },
              heartRate: { value: `${summary.avgHeartRate || 0}`, unit: 'bpm avg', trend: period, trendDirection: 'neutral' },
              sleep: { value: formatSleepMinutes(summary.avgSleepMinutes), unit: 'avg', trend: 'Per night', trendDirection: 'neutral' },
              workouts: {
                value: formatNumberWithCommas(summary.workoutCount),
                unit: summary.workoutCount === 1 ? 'session' : 'sessions',
                trend: period,
                trendDirection: 'neutral',
              },
              weeklyActivity: {
                avgSteps: formatNumberWithCommas(Math.round(summary.steps / daysSoFar)),
                days: buildBars(range, summary.dailySteps, now),
                loaded: true,
                periodStart: summary.dailySteps[0]?.date ?? localDateKey(rangeStart(apiRange, now)),
                firstDataDate: firstDayWithSteps(summary.dailySteps),
              },
            },
          },
        }));
      } catch (e) {
        devWarn(`[useMetricsStore] fetchRangeData(${range}) failed:`, e);
        set({ isLoadingRangeData: false });
        markLoaded(range);
      }
      }),
  };
});
