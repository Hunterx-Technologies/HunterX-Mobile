const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const mockGetInstallReferrer = jest.fn<Promise<string>, []>();
jest.mock('expo-application', () => ({
  getInstallReferrerAsync: () => mockGetInstallReferrer(),
}));

import { Platform } from 'react-native';

import {
  captureInstallReferrer,
  extractReferralCode,
  getPendingReferral,
  normalizeReferralCode,
  parseInstallReferrer,
  savePendingReferral,
} from '@/services/referral/pendingReferral';

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  mockStore.clear();
  mockGetInstallReferrer.mockReset();
  jest.useRealTimers();
});

describe('normalizeReferralCode', () => {
  it.each([
    ['ax7kpq2m', 'AX7KPQ2M'],
    ['  AX7KPQ ', 'AX7KPQ'],
    ['45JLFI17', '45JLFI17'], // older codes may contain 0/O/1/I
  ])('accepts %p', (raw, expected) => {
    expect(normalizeReferralCode(raw)).toBe(expected);
  });

  it.each(['', 'ABC12', 'ABCDEFGHJ', 'AB-CD12', null, undefined])('rejects %p', (raw) => {
    expect(normalizeReferralCode(raw)).toBeNull();
  });
});

describe('extractReferralCode', () => {
  it.each([
    ['AX7KPQ2M', 'AX7KPQ2M'],
    ['https://hunterx.co.in/invite/ax7kpq2m', 'AX7KPQ2M'],
    ['Join me on HunterX! Use my code AX7KPQ2M: https://hunterx.co.in/invite/AX7KPQ2M', 'AX7KPQ2M'],
    ['hunterx://invite/AX7KPQ2M', 'AX7KPQ2M'],
    ['https://join.hunterx.app/guestpass/AX7KPQ2M', 'AX7KPQ2M'],
  ])('finds the code in %p', (text, expected) => {
    expect(extractReferralCode(text)).toBe(expected);
  });

  it.each(['hello world', '', 'https://hunterx.co.in/invite/AB'])('finds nothing in %p', (text) => {
    expect(extractReferralCode(text)).toBeNull();
  });
});

describe('parseInstallReferrer', () => {
  it.each([
    ['ref=AX7KPQ2M', 'AX7KPQ2M'],
    ['utm_source=google-play&ref=ax7kpq2m&utm_medium=x', 'AX7KPQ2M'],
    ['utm_source=x&ref=AX7KPQ2M%20', 'AX7KPQ2M'],
  ])('reads %p', (referrer, expected) => {
    expect(parseInstallReferrer(referrer)).toBe(expected);
  });

  it.each([
    'utm_source=google-play&utm_medium=organic',
    'ref=',
    'ref=NOT-A-CODE',
    'ref=%E0%A4%A', // malformed encoding
    '',
  ])('ignores %p', (referrer) => {
    expect(parseInstallReferrer(referrer)).toBeNull();
  });
});

describe('pending referral storage', () => {
  it('round-trips a valid code', async () => {
    await savePendingReferral('ax7kpq2m');
    expect(await getPendingReferral()).toBe('AX7KPQ2M');
  });

  it('does not save a malformed code', async () => {
    await savePendingReferral('nope');
    expect(await getPendingReferral()).toBeNull();
  });

  it('keeps the code for 7 days, then drops it', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 1) });
    await savePendingReferral('AX7KPQ2M');

    jest.setSystemTime(new Date(2026, 9, 1).getTime() + 7 * DAY_MS - 1000);
    expect(await getPendingReferral()).toBe('AX7KPQ2M');

    jest.setSystemTime(new Date(2026, 9, 1).getTime() + 7 * DAY_MS + 1000);
    expect(await getPendingReferral()).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it('still reads a bare code saved by an older build', async () => {
    mockStore.set('hunterx.pendingReferralCode', 'AX7KPQ2M');
    expect(await getPendingReferral()).toBe('AX7KPQ2M');
  });
});

describe('captureInstallReferrer', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('saves the referrer code once on Android', async () => {
    Platform.OS = 'android';
    mockGetInstallReferrer.mockResolvedValue('utm_source=x&ref=AX7KPQ2M');
    await captureInstallReferrer();
    expect(await getPendingReferral()).toBe('AX7KPQ2M');

    await captureInstallReferrer();
    expect(mockGetInstallReferrer).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a code from an invite link', async () => {
    Platform.OS = 'android';
    await savePendingReferral('LINKCODE');
    mockGetInstallReferrer.mockResolvedValue('ref=AX7KPQ2M');
    await captureInstallReferrer();
    expect(await getPendingReferral()).toBe('LINKCODE');
  });

  it('ignores a referrer without a valid code', async () => {
    Platform.OS = 'android';
    mockGetInstallReferrer.mockResolvedValue('utm_source=google-play&utm_medium=organic');
    await captureInstallReferrer();
    expect(await getPendingReferral()).toBeNull();
  });

  it('never runs on iOS', async () => {
    Platform.OS = 'ios';
    await captureInstallReferrer();
    expect(mockGetInstallReferrer).not.toHaveBeenCalled();
  });
});
