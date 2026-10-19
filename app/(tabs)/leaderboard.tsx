import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen } from '@/components/common/Screen';
import { LeaderboardHeroHeader } from '@/components/features/leaderboard/LeaderboardHeroHeader';
import {
  TopCategoryFilterBar,
  type MainCategoryTab,
} from '@/components/features/leaderboard/LeaderboardFilterPills';
import { LeaderboardTop5HighlightCard } from '@/components/features/leaderboard/LeaderboardTop5HighlightCard';
import {
  LeaderboardHunterRow,
  type LeaderboardHunter,
} from '@/components/features/leaderboard/LeaderboardHunterRow';
import { LeaderboardTop5Modal } from '@/components/features/leaderboard/LeaderboardTop5Modal';
import { LeaderboardHelpModal } from '@/components/features/leaderboard/LeaderboardHelpModal';
import {
  HunterDetailModal,
  type HunterDetailData,
} from '@/components/features/leaderboard/HunterDetailModal';

import { useAuth } from '@/hooks/useAuth';

import { OFFICIAL_HUNTER_AVATARS, useAvatarsReady } from '@/services/api/avatar.service';
import { getAvatarSource } from '@/components/profile/AvatarSelectionModal';

const GLOBAL_LEADERBOARD_LIST: LeaderboardHunter[] = [
  {
    id: '1',
    rank: 1,
    displayName: 'ShadowRise',
    score: 237420,
    level: 28,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[0].image_url,
    streakDays: 28,
    quote: 'Arise from the shadows. Greatness belongs to the disciplined.',
  },
  {
    id: '2',
    rank: 2,
    displayName: 'Zenith',
    score: 229880,
    level: 26,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[1].image_url,
    streakDays: 26,
    quote: 'Throughout Heaven and Earth, consistency is the true power.',
  },
  {
    id: '3',
    rank: 3,
    displayName: 'Nova',
    score: 218540,
    level: 25,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[2].image_url,
    streakDays: 25,
    quote: 'Mastery comes to those who endure without hesitation.',
  },
  {
    id: '4',
    rank: 4,
    displayName: 'PixelPulse',
    score: 201365,
    level: 24,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[3].image_url,
    streakDays: 24,
    quote: 'Every rep counts. Leveling up is a non-negotiable grind.',
  },
  {
    id: '5',
    rank: 5,
    displayName: 'NightRunner',
    score: 198430,
    level: 24,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[4].image_url,
    streakDays: 24,
    quote: 'I never back down from a goal. That is my Hunter way!',
  },
  {
    id: '6',
    rank: 6,
    displayName: 'StrideSenpai',
    score: 189210,
    level: 23,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[5].image_url,
    streakDays: 23,
    quote: 'If you don’t dare to dream big, you’ll never cross the finish line!',
  },
  {
    id: '7',
    rank: 7,
    displayName: 'MotionMind',
    score: 176980,
    level: 22,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[6].image_url,
    streakDays: 22,
    quote: 'Push past your limits! There is always a higher level to reach.',
  },
  {
    id: '8',
    rank: 8,
    displayName: 'GoalGetter',
    score: 165740,
    level: 21,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[7].image_url,
    streakDays: 21,
    quote: 'Discipline today, victory tomorrow.',
  },
  {
    id: '9',
    rank: 9,
    displayName: 'Vanguard',
    score: 154200,
    level: 20,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[8].image_url,
    streakDays: 19,
    quote: 'Stand firm against the tide. The hunt never ceases.',
  },
  {
    id: '10',
    rank: 10,
    displayName: 'BloodOath',
    score: 148900,
    level: 19,
    avatarUrl: OFFICIAL_HUNTER_AVATARS[9].image_url,
    streakDays: 18,
    quote: 'Strength is earned through sweat, blood, and iron will.',
  },
];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  useAvatarsReady();

  // Filters State
  const [category, setCategory] = useState<MainCategoryTab>('Global');
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [top5ModalVisible, setTop5ModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedHunter, setSelectedHunter] = useState<HunterDetailData | null>(null);

  // Dynamic current user data (Rank 12 by default as shown in design)
  const currentUserData = useMemo<LeaderboardHunter>(() => {
    const userAny = user as any;
    const userLevel = user?.user_progression?.current_level ?? user?.level ?? 20;
    const userXp = user?.user_progression?.total_xp ?? user?.xp ?? 142350;
    const userStreak = user?.currentStreak ?? user?.user_progression?.daily_streak ?? 14;
    const resolvedAvatar = getAvatarSource(user?.avatarUrl, userAny?.avatar_id);
    const userAvatar = resolvedAvatar?.uri || OFFICIAL_HUNTER_AVATARS[0].image_url;

    return {
      id: user?.id || 'current-user',
      rank: 12,
      displayName: 'You',
      score: userXp,
      level: userLevel,
      avatarUrl: userAvatar,
      streakDays: userStreak,
      quote: 'Discipline today, a stronger you tomorrow.',
      isCurrentUser: true,
    };
  }, [user]);

  // Filtered hunters based on category tab
  const displayedHunters = useMemo(() => {
    if (category === 'Friends') {
      return GLOBAL_LEADERBOARD_LIST.filter((h) => ['2', '3', '6'].includes(h.id));
    }
    return GLOBAL_LEADERBOARD_LIST;
  }, [category]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }, []);

  return (
    <Screen style={styles.screenContainer} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#09090B" />

      {/* Dark background canvas */}
      <LinearGradient
        colors={['#09090B', '#09090B', '#050507']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.mainLayout}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#EF4444"
              colors={['#EF4444']}
            />
          }
        >
          {/* 1. HERO HEADER WITH LEADERBOARD GRAPHIC & BRAND */}
          <LeaderboardHeroHeader
            onInfoPress={() => setHelpModalVisible(true)}
          />

          {/* 2. CATEGORY FILTER PILLS (Global | Friends) */}
          <TopCategoryFilterBar
            category={category}
            onSelectCategory={setCategory}
          />

          {/* 3. YOU • TOP 5% HIGHLIGHT CARD */}
          <LeaderboardTop5HighlightCard
            onPress={() => setTop5ModalVisible(true)}
          />

          {/* 4. RANKED LIST CARDS (1, 2, 3 Crown Cards + 4-8 Standard Cards) */}
          <View style={styles.rankListWrapper}>
            {displayedHunters.map((hunter) => (
              <LeaderboardHunterRow
                key={hunter.id}
                hunter={hunter}
                onPress={() => setSelectedHunter(hunter)}
              />
            ))}
          </View>

          {/* Bottom spacer so scroll can comfortably reveal the last item above the pinned card */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* 5. PINNED CURRENT USER CARD (Rank 12) AT BOTTOM */}
        <View style={styles.pinnedUserSection}>
          <LinearGradient
            colors={['rgba(9, 9, 11, 0)', 'rgba(9, 9, 11, 0.85)', '#09090B']}
            style={styles.pinnedGradientOverlay}
            pointerEvents="none"
          />
          <LeaderboardHunterRow
            hunter={currentUserData}
            onPress={() => setSelectedHunter(currentUserData)}
          />
        </View>
      </View>

      {/* Hunter Detail Modal */}
      <HunterDetailModal
        visible={!!selectedHunter}
        hunter={selectedHunter}
        onClose={() => setSelectedHunter(null)}
      />

      {/* Top 5 Highlight Modal */}
      <LeaderboardTop5Modal
        visible={top5ModalVisible}
        onClose={() => setTop5ModalVisible(false)}
      />

      {/* Rules / Help Modal */}
      <LeaderboardHelpModal
        visible={helpModalVisible}
        onClose={() => setHelpModalVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  mainLayout: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  rankListWrapper: {
    marginTop: 2,
  },
  bottomSpacer: {
    height: 74,
  },
  pinnedUserSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 6,
    zIndex: 30,
  },
  pinnedGradientOverlay: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
