import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TasksTodayData } from '@/types/task';

// The last GET /tasks/today response, kept per account and per (local) day,
// so Home can show today's quests instantly on a cold start or offline and
// then refresh in the background. A response from an earlier day is ignored.

const KEY_PREFIX = 'hunterx-tasks-today-v1:';

type Entry = { day: string; data: TasksTodayData };

function localDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function readTasksTodayCache(userId: string): Promise<TasksTodayData | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry;
    return entry?.day === localDay() && entry.data ? entry.data : null;
  } catch {
    return null;
  }
}

export function writeTasksTodayCache(userId: string, data: TasksTodayData): void {
  const entry: Entry = { day: localDay(), data };
  AsyncStorage.setItem(KEY_PREFIX + userId, JSON.stringify(entry)).catch(() => {});
}

/** On sign-out: the next account on this device must never see these. */
export async function clearTasksTodayCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(KEY_PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // Keyed per account anyway, so a leftover is never shown to someone else.
  }
}
