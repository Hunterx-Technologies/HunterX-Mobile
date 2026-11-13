import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  LayoutChangeEvent,
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
import { InviteNudgeCard } from '@/components/features/invite/InviteNudgeCard';
import { HunterCardModal, type HunterCardTarget } from '@/components/features/friends/HunterCardModal';
import { FriendRequestsStrip } from '@/components/features/friends/FriendRequestsStrip';
import { FriendCodeInput } from '@/components/features/friends/FriendCodeInput';
import { useFriendsStore } from '@/store/useFriendsStore';
import type { FriendRequest } from '@/types/friends';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaderboardScope } from '@/hooks/useLeaderboard';
import { useAvatarsReady } from '@/services/api/avatar.service';
import type { LeaderboardEntry, LeaderboardMe, LeaderboardScope } from '@/types/leaderboard';
import { useScrollToTopOnFocus } from '@/hooks/useScrollToTopOnFocus';

// Gap between the floating "you" row and the bottom of the screen.
const FLOATING_ME_BOTTOM = 8;

const SCOPE_BY_TAB: Record<MainCategoryTab, LeaderboardScope> = {
  Global: 'global',
  Friends: 'friends',
};

// First list item carries the non-sticky intro (community card, table
// header, top 3, empty states); the rest are regular ranked rows.
type ListItem = { kind: 'intro' } | { kind: 'entry'; entry: LeaderboardEntry };
const INTRO_ITEM: ListItem = { kind: 'intro' };

function toHunter(entry: LeaderboardEntry): LeaderboardHunter {
  return {
    id: entry.userId,
    rank: entry.rank,
    displayName: entry.isMe ? 'You' : entry.name,
    score: entry.totalXp,
    level: entry.level,
    avatarUrl: entry.avatarThumbUrl,
    isCurrentUser: entry.isMe,
    streak: entry.streak,
  };
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  // Plain-number copy of the scroll offset for JS decisions (scope switch).
  const scrollOffsetRef = useRef(0);
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        },
      }),
    [scrollY]
  );
  useAvatarsReady();


  const [category, setCategory] = useState<MainCategoryTab>('Global');
  const scope = SCOPE_BY_TAB[category];

  const {
    entries,
    me: rawMe,
    emptyState,
    nextCursor,
    isInitialLoading,
    isFetchingMore,
    error,
    loadMore,
    refresh,
  } = useLeaderboardScope(scope, user?.id != null ? String(user.id) : null);

  // One hunter card for the whole screen; tapping a row only sets which
  // hunter it shows, so the list itself never re-renders for it.
  const [cardTarget, setCardTarget] = useState<HunterCardTarget | null>(null);
  const openHunter = useCallback((hunter: LeaderboardHunter) => {
    if (hunter.isCurrentUser) return;
    setCardTarget({
      kind: 'id',
      userId: hunter.id,
      preview: {
        userId: hunter.id,
        name: hunter.displayName,
        avatarThumbUrl: hunter.avatarUrl,
        level: hunter.level,
        totalXp: hunter.score,
        streak: hunter.streak,
        rank: hunter.rank,
      },
    });
  }, []);
  const openRequest = useCallback((r: FriendRequest) => {
    setCardTarget({ kind: 'id', userId: r.userId, preview: r });
  }, []);
  const openByCode = useCallback((code: string) => setCardTarget({ kind: 'code', code }), []);

  // Requests waiting for me: refreshed when the screen is opened and when
  // Friends is picked (the strip shows the last list meanwhile).
  const friendRequestCount = useFriendsStore((s) => s.requests.length);
  const loadFriendRequests = useFriendsStore((s) => s.loadRequests);
  useFocusEffect(
    useCallback(() => {
      loadFriendRequests();
    }, [loadFriendRequests])
  );
  useEffect(() => {
    if (scope === 'friends') loadFriendRequests();
  }, [scope, loadFriendRequests]);

  const [top5ModalVisible, setTop5ModalVisible] = useState(false);
  const openInvite = useCallback(() => router.push('/invite-friends'), []);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Ranks 1-3 render as the existing gold/silver/bronze featured cards,
  // always a prefix of the combined, rank-ordered entries list — rendered
  // once in the intro item rather than as virtualized rows.
  const top3 = useMemo(() => entries.filter((e) => e.rank != null && e.rank <= 3), [entries]);
  const rest = useMemo(() => entries.filter((e) => e.rank == null || e.rank > 3), [entries]);

  const meEntry = useMemo(() => entries.find((e) => e.isMe) ?? null, [entries]);
  const meInList = meEntry != null;
  const meInListRef = useRef(meInList);
  meInListRef.current = meInList;

  // `me.rank` is null while server rankings catch up; the viewer's own list
  // row can still carry it, which keeps the card tappable for sharing.
  const me = useMemo<LeaderboardMe | null>(
    () =>
      rawMe && rawMe.rank == null && meEntry?.rank != null
        ? { ...rawMe, rank: meEntry.rank }
        : rawMe,
    [rawMe, meEntry]
  );

  const meHunter = useMemo<LeaderboardHunter | null>(() => {
    if (!me || me.status !== 'ranked') return null;
    return {
      id: 'me',
      rank: me.rank,
      displayName: 'You',
      score: me.totalXp,
      level: me.level,
      avatarUrl: me.avatarThumbUrl,
      isCurrentUser: true,
      streak: me.streak,
    };
  }, [me]);

  // Floating "you" row: pinned near the footer while the viewer's real row
  // is off screen, handed off to the real row once it scrolls into the
  // pinned spot, and pinned again once it scrolls up under the header.
  const listRef = useRef<FlatList<ListItem>>(null);
  useScrollToTopOnFocus(listRef);
  const meRowRef = useRef<View>(null);
  // null = not measured yet; 'missing' = the row isn't rendered (e.g. far
  // down a virtualized list); otherwise its position in the scroll content.
  const [meRowLayout, setMeRowLayout] = useState<{ y: number; height: number } | 'missing' | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);

  // Position of the real row within the scroll content, so visibility can
  // be derived from scrollY on the native thread.
  const measureMeRow = useCallback(() => {
    const row = meRowRef.current;
    if (!row) {
      // 'missing' only when the viewer IS in the loaded rows but their row
      // isn't rendered (far down the list). While a scope's first page is
      // still loading there are no rows at all — that isn't 'missing', and
      // treating it so flashed the pinned "You" over the list for a frame.
      setMeRowLayout(meInListRef.current ? 'missing' : null);
      return;
    }
    const content = (listRef.current?.getNativeScrollRef() as any)?.getInnerViewRef?.();
    if (!content) return;
    row.measureLayout(content, (_x, y, _w, height) => {
      setMeRowLayout((prev) =>
        prev && prev !== 'missing' && prev.y === y && prev.height === height ? prev : { y, height }
      );
    });
  }, []);

  // Switching Global ⇄ Friends: forget the old scope's row position, then
  // measure the new one a frame after it renders. Waiting for onLayout alone
  // missed rows that land at the same spot (onLayout doesn't fire), leaving
  // the pinned and the real "You" row both on screen.
  useEffect(() => {
    setMeRowLayout(null);
  }, [scope]);

  // Re-measure once rows render — after a scope switch and as pages load.
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(measureMeRow);
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [scope, entries, measureMeRow]);

  const handleSelectCategory = useCallback(
    (next: MainCategoryTab) => {
      if (next === category) return;
      // Scrolled past the hero: start the new scope right under the pinned
      // tabs, instead of keeping an offset into the old (often longer) list.
      if (scrollOffsetRef.current > HERO_SPACER) {
        listRef.current?.scrollToOffset({ offset: HERO_SPACER, animated: false });
      }
      // In the same update as the switch, so the new scope's first frame
      // doesn't use the old scope's row position (that frame showed the
      // pinned "You" over the list with a gap where the real row belongs).
      setMeRowLayout(null);
      setCategory(next);
    },
    [category]
  );

  // Pushes and notifications open /(tabs)/leaderboard?tab=friends.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    if (tabParam !== 'friends') return;
    handleSelectCategory('Friends');
    router.setParams({ tab: undefined });
  }, [tabParam, handleSelectCategory]);

  const floatingMeOpacity = useMemo(() => {
    // Not in the loaded rows, or in them but not rendered: pin the copy.
    if (!meInList || meRowLayout === 'missing') return 1;
    // Rendered but not measured yet (e.g. right after Global ⇄ Friends):
    // show the real row only — never both, and never a gap where it belongs.
    if (!meRowLayout || viewportHeight === 0) return 0;
    const { y, height } = meRowLayout;
    // scrollY at which the real row reaches the floating row's slot.
    const dockAt = y + height + FLOATING_ME_BOTTOM - viewportHeight;
    // scrollY at which the real row is fully hidden under the sticky header.
    const undockAt = y + height - stickyHeaderHeight;
    if (undockAt <= dockAt + 1) {
      return scrollY.interpolate({
        inputRange: [dockAt - 1, dockAt],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });
    }
    return scrollY.interpolate({
      inputRange: [dockAt - 1, dockAt, undockAt, undockAt + 1],
      outputRange: [1, 0, 0, 1],
      extrapolate: 'clamp',
    });
  }, [meInList, meRowLayout, viewportHeight, stickyHeaderHeight, scrollY]);

  // The real row is hidden while the floating copy shows, so it never peeks
  // out below the floating row before the handoff.
  // Whichever of the two is showing, the other hides — exactly one "You"
  // row is ever on screen.
  const realMeOpacity = useMemo(() => {
    if (!meHunter) return 1;
    if (typeof floatingMeOpacity === 'number') return 1 - floatingMeOpacity;
    return floatingMeOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  }, [meHunter, floatingMeOpacity]);

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
    <View onLayout={(e: LayoutChangeEvent) => setStickyHeaderHeight(e.nativeEvent.layout.height)}>
      <LeaderboardHeroHeader scrollY={scrollY} />
      <View style={styles.solidSection}>
        <TopCategoryFilterBar
          category={category}
          onSelectCategory={handleSelectCategory}
          badges={{ Friends: friendRequestCount }}
        />
      </View>
    </View>
  );

  // Opaque so it slides over the fixed background artwork.
  const listIntro = (
    <View style={styles.solidSection}>
      <LeaderboardCommunityCard
        me={me}
        userId={user?.id != null ? String(user.id) : null}
        onPressRanked={me?.rank != null ? () => setTop5ModalVisible(true) : undefined}
        onPressSettings={() => setSettingsModalVisible(true)}
      />

      {/* Friends tab: requests waiting for me, and adding someone by code. */}
      {scope === 'friends' && !showSkeleton ? (
        <>
          <FriendRequestsStrip onOpen={openRequest} />
          <FriendCodeInput compact onFind={openByCode} ownCode={user?.referral_code ?? null} />
        </>
      ) : null}

      {/* Invite card: Friends tab only, always there above the list (the
          empty state has its own button). Global has none. */}
      {scope === 'friends' && !showSkeleton && !showBlockingError && entries.length > 0 ? (
        <InviteNudgeCard onInvite={openInvite} persistent />
      ) : null}

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
          {top3.map((entry) =>
            entry.isMe ? (
              <View key={entry.userId} ref={meRowRef} onLayout={measureMeRow}>
                <Animated.View style={{ opacity: realMeOpacity }}>
                  <LeaderboardHunterRow hunter={toHunter(entry)} />
                </Animated.View>
              </View>
            ) : (
              <LeaderboardHunterRow key={entry.userId} hunter={toHunter(entry)} onPress={openHunter} />
            )
          )}
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
            onPress={openInvite}
            accessibilityRole="button"
          >
            <Text style={styles.inviteButtonText}>Invite a friend</Text>
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
        <View
          ref={item.entry.isMe ? meRowRef : undefined}
          onLayout={item.entry.isMe ? measureMeRow : undefined}
          style={styles.solidSection}
        >
          {item.entry.isMe ? (
            <Animated.View style={{ opacity: realMeOpacity }}>
              <LeaderboardHunterRow hunter={toHunter(item.entry)} />
            </Animated.View>
          ) : (
            <LeaderboardHunterRow hunter={toHunter(item.entry)} onPress={openHunter} />
          )}
        </View>
      ),
    // listIntro is rebuilt each render; only the single intro cell depends on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listIntro, measureMeRow, realMeOpacity, openHunter]
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
      <View
        style={[styles.listArea, { top: insets.top + HERO_STOP }]}
        onLayout={(e: LayoutChangeEvent) => setViewportHeight(e.nativeEvent.layout.height)}
      >
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
            ref={listRef}
            bounces={false}
            overScrollMode="never"
            data={listData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={stickyHeader}
            stickyHeaderIndices={[0]}
            ListFooterComponent={
              <View style={styles.solidSection}>
                {isFetchingMore ? <FooterSpinner /> : null}
              </View>
            }
            onScroll={handleScroll}
            scrollEventThrottle={16}
            // At least a screen taller than the hero, so switching to a short
            // scope (Friends) can scroll to the pinned tabs straight away.
            // Shorter, Android held that scroll and applied it once the
            // rows loaded — the page jumped under the user's finger.
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: HERO_SPACER },
              viewportHeight > 0 && { minHeight: viewportHeight + HERO_SPACER },
            ]}
            // Rows above the viewer's (intro, top 3) can change height.
            onContentSizeChange={measureMeRow}
            // Taps on Find / Accept go through while the keyboard is open
            // (otherwise the first tap only closes the keyboard).
            keyboardShouldPersistTaps="handled"
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

      {/* Pinned "you" row — only while status is 'ranked' and the real row
          isn't on screen. Never interactive, so touches reach the list. */}
      {meHunter ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.stickyBottomWrapper, { opacity: floatingMeOpacity }]}
        >
          <LeaderboardHunterRow hunter={meHunter} />
        </Animated.View>
      ) : null}

      <LeaderboardTop5Modal
        visible={top5ModalVisible}
        onClose={() => setTop5ModalVisible(false)}
        me={me}
      />

      <HunterCardModal target={cardTarget} onClose={() => setCardTarget(null)} />

      <SystemSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        user={user}
        onUpdateUser={setUser}
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
    bottom: FLOATING_ME_BOTTOM,
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  inviteButtonText: {
    color: '#0D0F12',
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
    backgroundColor: '#27272A',
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
