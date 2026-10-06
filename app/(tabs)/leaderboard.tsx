import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ListRenderItem,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/common/Screen';
import {
  HERO_SPACER,
  HERO_STOP,
  LeaderboardBrandBar,
  LeaderboardHeroBackground,
  LeaderboardHeroHeader,
} from '@/components/features/leaderboard/LeaderboardHeroHeader';
import {
  TopCategoryFilterBar,
  type MainCategoryTab,
} from '@/components/features/leaderboard/LeaderboardFilterPills';
import { LeaderboardCommunityCard } from '@/components/features/leaderboard/LeaderboardCommunityCard';
import {
  LeaderboardHunterRow,
  type LeaderboardHunter,
} from '@/components/features/leaderboard/LeaderboardHunterRow';
import { LeaderboardTop5Modal } from '@/components/features/leaderboard/LeaderboardTop5Modal';
import { SystemSettingsModal } from '@/components/profile/SystemSettingsModal';
import { InviteFriendsModal } from '@/components/profile/InviteFriendsModal';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaderboardScope } from '@/hooks/useLeaderboard';
import { useAvatarsReady } from '@/services/api/avatar.service';
import type { LeaderboardEntry, LeaderboardScope } from '@/types/leaderboard';

const SCOPE_BY_TAB: Record<MainCategoryTab, LeaderboardScope> = {
  Global: 'global',
  Friends: 'friends',
  'Gen Z': 'genz',
};

// First list item carries the non-sticky intro (community card, table
// header, top 3, empty states); the rest are regular ranked rows.
type ListItem = { kind: 'intro' } | { kind: 'entry'; entry: LeaderboardEntry };
const INTRO_ITEM: ListItem = { kind: 'intro' };

function toHunter(entry: LeaderboardEntry): LeaderboardHunter {
  return {
    id: entry.userId,
    rank: entry.rank,
    displayName: entry.name,
    score: entry.totalXp,
    level: entry.level,
    avatarUrl: entry.avatarThumbUrl,
    isCurrentUser: entry.isMe,
  };
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY]
  );
  useAvatarsReady();

  const userAny = user as any;
  const displayName = userAny?.name ?? user?.displayName ?? 'Shadow Hunter';
  const referralCode = userAny?.referral_code ?? undefined;

  const [category, setCategory] = useState<MainCategoryTab>('Global');
  const scope = SCOPE_BY_TAB[category];

  const {
    entries,
    me,
    emptyState,
    nextCursor,
    isInitialLoading,
    isFetchingMore,
    error,
    loadMore,
    refresh,
  } = useLeaderboardScope(scope, user?.id != null ? String(user.id) : null);

  const [top5ModalVisible, setTop5ModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  // Ranks 1-3 render as the existing gold/silver/bronze featured cards,
  // always a prefix of the combined, rank-ordered entries list — rendered
  // once in the intro item rather than as virtualized rows.
  const top3 = useMemo(() => entries.filter((e) => e.rank != null && e.rank <= 3), [entries]);
  const rest = useMemo(() => entries.filter((e) => e.rank == null || e.rank > 3), [entries]);

  // Don't float a duplicate of a row that's already visible on screen —
  // once a page load reaches the viewer's own rank, their real row
  // (correctly styled gold/silver/bronze if applicable) is enough.
  const meAlreadyVisible = entries.some((e) => e.isMe);

  const meHunter = useMemo<LeaderboardHunter | null>(() => {
    if (!me || me.status !== 'ranked' || meAlreadyVisible) return null;
    return {
      id: 'me',
      rank: me.rank,
      displayName: me.name,
      score: me.totalXp,
      level: me.level,
      avatarUrl: me.avatarThumbUrl,
      isCurrentUser: true,
    };
  }, [me, meAlreadyVisible]);

  // onEndReached can fire several times per scroll gesture; this plus
  // the hook's own in-flight guard keeps a fast scroll from firing the
  // next-page request twice.
  const calledDuringMomentum = useRef(false);

  const handleEndReached = useCallback(() => {
    if (calledDuringMomentum.current) return;
    if (!nextCursor || isFetchingMore) return;
    calledDuringMomentum.current = true;
    loadMore();
  }, [nextCursor, isFetchingMore, loadMore]);

  const listData = useMemo<ListItem[]>(
    () => [INTRO_ITEM, ...rest.map((entry) => ({ kind: 'entry' as const, entry }))],
    [rest]
  );

  const keyExtractor = useCallback(
    (item: ListItem) => (item.kind === 'intro' ? '__intro__' : item.entry.userId),
    []
  );

  const showSkeleton = isInitialLoading && entries.length === 0;
  const showBlockingError = Boolean(error) && !isInitialLoading && entries.length === 0;

  // Sticks at the top of the clipped list area (HERO_STOP) once scrolled up.
  const stickyHeader = (
    <View>
      <LeaderboardHeroHeader scrollY={scrollY} />
      <View style={styles.solidSection}>
        <TopCategoryFilterBar category={category} onSelectCategory={setCategory} />
      </View>
    </View>
  );

  // Opaque so it slides over the fixed background artwork.
  const listIntro = (
    <View style={styles.solidSection}>
      <LeaderboardCommunityCard
        me={me}
        onPressRanked={me?.rank != null ? () => setTop5ModalVisible(true) : undefined}
        onPressSettings={() => setSettingsModalVisible(true)}
      />

      {!showSkeleton && !showBlockingError && entries.length > 0 ? (
        <View style={styles.tableHeaderRow}>
          <Text style={styles.headerColRank}>#</Text>
          <Text style={styles.headerColUser}>User</Text>
          <Text style={styles.headerColLevel}>Level</Text>
          <Text style={styles.headerColXp}>XP</Text>
        </View>
      ) : null}

      {showSkeleton ? <SkeletonRows /> : null}

      {!showSkeleton && top3.length > 0 ? (
        <View style={styles.top3Container}>
          {top3.map((entry) => (
            <LeaderboardHunterRow key={entry.userId} hunter={toHunter(entry)} />
          ))}
        </View>
      ) : null}

      {scope === 'friends' && emptyState === 'no_friends' && !showSkeleton ? (
        <View style={styles.noFriendsBlock}>
          <Text style={styles.noFriendsText}>
            No friends yet. Invite hunters and climb together.
          </Text>
          <TouchableOpacity
            style={styles.inviteButton}
            activeOpacity={0.85}
            onPress={() => setInviteModalVisible(true)}
          >
            <Text style={styles.inviteButtonText}>Invite Friends</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {emptyState === 'no_entries' && !showSkeleton ? (
        <View style={styles.noFriendsBlock}>
          <Text style={styles.noFriendsText}>No one&apos;s on the leaderboard yet.</Text>
        </View>
      ) : null}
    </View>
  );

  const renderItem: ListRenderItem<ListItem> = useCallback(
    ({ item }) =>
      item.kind === 'intro' ? (
        listIntro
      ) : (
        <View style={styles.solidSection}>
          <LeaderboardHunterRow hunter={toHunter(item.entry)} />
        </View>
      ),
    // listIntro is rebuilt each render; only the single intro cell depends on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listIntro]
  );

  return (
    <Screen style={styles.screenContainer} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <LinearGradient
        colors={['#09090B', '#09090B', '#060608']}
        style={StyleSheet.absoluteFillObject}
      />

      <LeaderboardHeroBackground scrollY={scrollY} top={insets.top} />

      {/* The list lives in a clipped area starting at HERO_STOP, so swiping
          up stops the title + pills mid-hero and rows scroll beneath them. */}
      <View style={[styles.listArea, { top: insets.top + HERO_STOP }]}>
        {showBlockingError ? (
          <Animated.ScrollView
            bounces={false}
            overScrollMode="never"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[styles.errorContainer, { paddingTop: HERO_SPACER }]}
            stickyHeaderIndices={[0]}
          >
            {stickyHeader}
            {listIntro}
            <View style={styles.errorBody}>
              <Text style={styles.errorTitle}>Couldn&apos;t load the leaderboard</Text>
              <Text style={styles.errorSubtitle}>{error?.message}</Text>
              <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={refresh}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </Animated.ScrollView>
        ) : (
          <Animated.FlatList
            bounces={false}
            overScrollMode="never"
            data={listData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={stickyHeader}
            stickyHeaderIndices={[0]}
            ListFooterComponent={
              <View style={styles.solidSection}>{isFetchingMore ? <FooterSpinner /> : null}</View>
            }
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[styles.scrollContent, { paddingTop: HERO_SPACER }]}
            onEndReached={handleEndReached}
            onEndReachedThreshold={1.5}
            onMomentumScrollBegin={() => {
              calledDuringMomentum.current = false;
            }}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={7}
            // Android can drop sticky headers when clipping subviews.
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <LeaderboardBrandBar scrollY={scrollY} top={insets.top} />

      {/* Pinned "you" row — only while status is 'ranked', regardless of
          whether this user's real row also happens to be on screen. */}
      {meHunter ? (
        <View style={styles.stickyBottomWrapper}>
          <LeaderboardHunterRow hunter={meHunter} />
        </View>
      ) : null}

      <LeaderboardTop5Modal
        visible={top5ModalVisible}
        onClose={() => setTop5ModalVisible(false)}
        me={me}
      />

      <SystemSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        user={user}
        onUpdateUser={setUser}
      />

      <InviteFriendsModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
        referralCode={referralCode}
        displayName={displayName}
      />
    </Screen>
  );
}

function SkeletonRows() {
  return (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2, 3, 4].map((key) => (
        <View key={key} style={styles.skeletonRow} />
      ))}
    </View>
  );
}

function FooterSpinner() {
  return (
    <View style={styles.footerSpinner}>
      <ActivityIndicator size="small" color="#FE5B01" />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  solidSection: {
    backgroundColor: '#09090B',
  },
  listArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  top3Container: {
    marginTop: 4,
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 2,
  },
  headerColRank: {
    width: 32,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  headerColUser: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    paddingLeft: 6,
  },
  headerColLevel: {
    width: 62,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  headerColXp: {
    width: 95,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'right',
    paddingRight: 8,
  },
  stickyBottomWrapper: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    zIndex: 99,
  },
  skeletonContainer: {
    marginTop: 4,
    gap: 8,
    paddingHorizontal: 16,
  },
  skeletonRow: {
    height: 58,
    borderRadius: 16,
    backgroundColor: '#141418',
  },
  footerSpinner: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noFriendsBlock: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 28,
    gap: 14,
  },
  noFriendsText: {
    fontSize: 14,
    color: '#8D98A3',
    textAlign: 'center',
    lineHeight: 20,
  },
  inviteButton: {
    backgroundColor: '#FE5B01',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  errorContainer: {
    flexGrow: 1,
  },
  errorBody: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#09090B',
  },
  errorTitle: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: '700',
    color: '#F4F5F6',
    textAlign: 'center',
  },
  errorSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#8D98A3',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: '#FE5B01',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
