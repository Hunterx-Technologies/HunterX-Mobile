import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { EmptyState } from '@/components/common/EmptyState';
import { Screen } from '@/components/common/Screen';
import { Skeleton } from '@/components/common/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { fetchNotifications, markNotificationsRead } from '@/services/api/notifications.service';
import { useNotificationStore } from '@/store/useNotificationStore';
import { palette } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import type { AppNotification } from '@/types/notification';
import { formatRelativeTime } from '@/utils/formatters';

type IconName = keyof typeof Ionicons.glyphMap;

const TYPE_ICON: Record<string, { icon: IconName; color: string }> = {
  DAILY_MOTIVATION:   { icon: 'flash-outline',          color: palette.gold },
  TASK_REMINDER:      { icon: 'list-outline',           color: palette.gold },
  NEW_QUEST:          { icon: 'compass-outline',        color: palette.gold },
  STREAK_AT_RISK:     { icon: 'flame',                  color: palette.red },
  STREAK_MILESTONE:   { icon: 'flame',                  color: palette.orange },
  STREAK_FREEZE_USED: { icon: 'shield-half-outline',    color: palette.blue },
  MONTHLY_FREEZE:     { icon: 'snow-outline',           color: palette.blue },
  STREAK_BROKEN:      { icon: 'heart-dislike-outline',  color: palette.red },
  LEVEL_UP:           { icon: 'sparkles-outline',       color: palette.purple },
  REWARD_READY:       { icon: 'gift-outline',           color: palette.green },
  FRIEND_JOINED:      { icon: 'people-outline',         color: palette.blue },
  LEADERBOARD_UPDATE: { icon: 'podium-outline',         color: palette.silver },
  BROADCAST:          { icon: 'megaphone-outline',      color: palette.silver },
  FEEDBACK_UPDATE:    { icon: 'chatbox-ellipses-outline', color: palette.green },
  HEALTH_SYNC:        { icon: 'pulse-outline',          color: palette.red },
  WIN_BACK:           { icon: 'hourglass-outline',      color: palette.gold },
};
const DEFAULT_ICON = { icon: 'notifications-outline' as IconName, color: palette.silver };

export default function NotificationsScreen() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  const [items, setItems] = useState<AppNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await fetchNotifications();
      setItems(page.notifications);
      setNextCursor(page.next_cursor);
      setUnreadCount(page.unread_count);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load notifications');
    }
  }, [setUnreadCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadFirstPage().finally(() => setIsInitialLoading(false));
  }, [isAuthenticated, loadFirstPage]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFirstPage();
    setIsRefreshing(false);
  }, [loadFirstPage]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const page = await fetchNotifications(nextCursor);
      setItems((prev) => [...prev, ...page.notifications]);
      setNextCursor(page.next_cursor);
    } catch {
      // Silent — the next scroll to the end retries.
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [nextCursor]);

  const handlePressItem = useCallback(async (item: AppNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!item.is_read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      setUnreadCount(unreadCount - 1);
      markNotificationsRead([item.id]).then(setUnreadCount).catch(() => {});
    }
    if (item.url) {
      router.push(item.url as Href);
    }
  }, [setUnreadCount, unreadCount]);

  const handleMarkAllRead = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    markNotificationsRead('all').then(setUnreadCount).catch(() => {});
  }, [setUnreadCount]);

  const navigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  if (isBootstrapping) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const renderItem = ({ item }: { item: AppNotification }) => {
    const { icon, color } = TYPE_ICON[item.type] ?? DEFAULT_ICON;
    return (
      <TouchableOpacity
        style={[styles.itemRow, !item.is_read && styles.itemRowUnread]}
        onPress={() => handlePressItem(item)}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { borderColor: `${color}55` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={styles.itemTextGroup}>
          <View style={styles.itemTitleRow}>
            <Text style={[styles.itemTitle, !item.is_read && styles.itemTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.itemTime}>{formatRelativeTime(item.created_at)}</Text>
          </View>
          <Text style={styles.itemBody} numberOfLines={2}>
            {item.body}
          </Text>
        </View>
        {!item.is_read ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={styles.screen}>
      {/* HEADER */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={navigateBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity style={styles.headerAction} onPress={handleMarkAllRead} activeOpacity={0.7}>
            <Text style={styles.headerActionText}>Read all</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerAction} />
        )}
      </View>

      {isInitialLoading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={40} height={40} borderRadius={12} />
              <View style={styles.skeletonText}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="90%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : loadError && items.length === 0 ? (
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>The System is unreachable</Text>
          <Text style={styles.errorDescription}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="No notifications yet"
              description="Quest reminders, streak alerts and rewards from the System will appear here."
            />
          }
          ListFooterComponent={isLoadingMore ? <ActivityIndicator style={styles.footerSpinner} color={palette.gold} /> : null}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={palette.gold} colors={[palette.gold]} />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1E',
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerAction: {
    minWidth: 38,
    height: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerActionText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: palette.gold,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  itemRowUnread: {
    backgroundColor: 'rgba(254, 91, 1, 0.05)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#111115',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextGroup: {
    flex: 1,
    gap: 3,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    color: '#D4D4D8',
  },
  itemTitleUnread: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
  },
  itemTime: {
    fontFamily: fontFamilies.regular,
    fontSize: 11.5,
    color: palette.slate500,
  },
  itemBody: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 18,
    color: palette.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.gold,
  },
  separator: {
    height: 1,
    backgroundColor: '#16161A',
    marginLeft: 68,
  },
  footerSpinner: {
    paddingVertical: 16,
  },
  skeletonList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonText: {
    flex: 1,
    gap: 8,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  errorTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  errorDescription: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.gold,
  },
  retryText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: palette.gold,
  },
});
