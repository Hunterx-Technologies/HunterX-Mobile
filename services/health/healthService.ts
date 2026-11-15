import { Platform } from 'react-native';
import { WEEKDAY_SHORT, currentWeekDays, emptyRangeSummary, localDateKey } from './HealthAdapter';
import type { HealthAdapter, HealthRange } from './HealthAdapter';
import { AppleHealthAdapter } from './AppleHealthAdapter';
import { HealthConnectAdapter } from './HealthConnectAdapter';

class DummyHealthAdapter implements HealthAdapter {
  async isAvailable() { return false; }
  async getAvailability() { return 'unavailable' as const; }
  async openSettings() {}
  async requestPermissions() { return false; }
  async checkPermissions() { return false; }
  async getTodaySummary() {
    const todayStr = localDateKey(new Date());
    return {
      date: todayStr,
      steps: 0,
      calories: 0,
      distanceKm: 0,
      activeMinutes: 0,
      heartRate: 0,
      sleepMinutes: 0,
      workoutCount: 0,
    };
  }
  async getRangeSummary(range: HealthRange) {
    return emptyRangeSummary(range);
  }
  async getWeekBarSamples() {
    return currentWeekDays().map((d) => ({
      day: WEEKDAY_SHORT[d.getDay()],
      label: WEEKDAY_SHORT[d.getDay()],
      date: localDateKey(d),
      value: 0,
      steps: 0,
    }));
  }
}

export const appleHealthAdapter = new AppleHealthAdapter();
export const healthConnectAdapter = new HealthConnectAdapter();

export function getAdapterForProvider(provider: 'apple_health' | 'health_connect'): HealthAdapter {
  if (provider === 'apple_health') {
    return appleHealthAdapter;
  }
  if (provider === 'health_connect') {
    return healthConnectAdapter;
  }
  return new DummyHealthAdapter();
}

export function createHealthAdapter(): HealthAdapter {
  if (Platform.OS === 'ios') {
    return appleHealthAdapter;
  } else if (Platform.OS === 'android') {
    return healthConnectAdapter;
  }
  return new DummyHealthAdapter();
}

export const healthService = createHealthAdapter();

