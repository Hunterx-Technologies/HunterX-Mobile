import React, { useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';

import { mapTaskToQuest, type QuestItem } from '@/utils/quests';
import { fetchTasksToday } from '@/services/api/tasks.service';
import { MissionResultsScreen } from '@/components/features/missions/MissionResultsScreen';

// Developer page: the day-complete screen with today's real missions, or
// these samples when there are none (or no one is signed in).
const SAMPLE: QuestItem[] = [
  { id: 's1', title: 'Sleep 8 Hours', category: 'sleep', xpReward: 10, type: 'daily', image: null, status: 'done' },
  { id: 's2', title: 'Drink Water', category: 'water', xpReward: 10, type: 'daily', image: null, status: 'done' },
  { id: 's3', title: 'Protein Goal', category: 'nutrition', xpReward: 10, type: 'daily', image: null, status: 'done' },
  { id: 's4', title: 'Daily Steps', category: 'steps', xpReward: 10, type: 'daily', image: null, status: 'done' },
  { id: 's5', title: 'Daily Reading', category: 'reading', xpReward: 10, type: 'daily', image: null, status: 'done' },
];

export default function MissionClearTestScreen() {
  const router = useRouter();
  const [quests, setQuests] = useState<QuestItem[] | null>(null);

  useEffect(() => {
    if (!__DEV__) return;
    fetchTasksToday()
      .then((data) => {
        const daily = (data.daily || []).map((item) => mapTaskToQuest(item, 'daily'));
        setQuests(daily.length > 0 ? daily : SAMPLE);
      })
      .catch(() => setQuests(SAMPLE));
  }, []);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
  // Developer page — not reachable in release builds.
  if (!__DEV__) return <Redirect href="/" />;
  if (!quests) return null;
  return <MissionResultsScreen quests={quests} onContinue={leave} />;
}
