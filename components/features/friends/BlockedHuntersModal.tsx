import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { Screen } from '@/components/common/Screen';
import { invalidateLeaderboardCache } from '@/hooks/useLeaderboard';
import { fetchBlockedHunters, unblockHunter } from '@/services/api/friends.service';
import { useFriendsStore } from '@/store/useFriendsStore';
import { showGlobalToast } from '@/store/useToastStore';
import { fontFamilies } from '@/theme/typography';
import type { BlockedHunter } from '@/types/friends';

const ORANGE = '#FE5B01';
const FALLBACK_AVATAR = 'https://res.cloudinary.com/sc8zzixt/image/upload/w_96,h_96,c_fill/f_auto,q_auto/v1788468328/hunterx/app-assets/arise_avatar_11.jpg';

function formatBlockedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Hunters I blocked (System Settings → Blocked hunters). They're hidden from
 * my Global leaderboard, so this is where they're unblocked; unblocking puts
 * them back on it.
 */
export function BlockedHuntersModal({ visible, onClose }: Props) {
  const applyRelationship = useFriendsStore((s) => s.applyRelationship);
  const [blocked, setBlocked] = useState<BlockedHunter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { blocked: list } = await fetchBlockedHunters();
      setBlocked(list);
    } catch (err) {
      setLoadError(err instanceof Error && err.message ? err.message : 'Could not load blocked hunters.');
    }
  }, []);

  useEffect(() => {
    if (visible) load();
    else {
      setBlocked(null);
      setLoadError(null);
    }
  }, [visible, load]);

  const unblock = useCallback(
    async (hunter: BlockedHunter) => {
      if (unblocking) return;
      setUnblocking(hunter.userId);
      Haptics.selectionAsync().catch(() => {});
      try {
        const { relationship } = await unblockHunter(hunter.userId);
        setBlocked((prev) => prev?.filter((h) => h.userId !== hunter.userId) ?? prev);
        // Their cached card (if opened this session) now reads unblocked, and
        // the leaderboard refetches so they show on Global again.
        applyRelationship(hunter.userId, relationship);
        invalidateLeaderboardCache();
        showGlobalToast(`${hunter.name} is unblocked.`, 'success');
      } catch (err) {
        showGlobalToast(err instanceof Error && err.message ? err.message : 'Could not unblock. Please try again.', 'error');
      } finally {
        setUnblocking(null);
      }
    },
    [unblocking, applyRelationship]
  );

  const renderItem = useCallback(
    ({ item }: { item: BlockedHunter }) => {
      const since = formatBlockedAt(item.blockedAt);
      const busy = unblocking === item.userId;
      return (
        <View style={styles.row}>
          <Image
            source={{ uri: item.avatarThumbUrl || FALLBACK_AVATAR }}
            style={styles.avatar}
            contentFit="cover"
            transition={0}
          />
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              Lv {item.level}{since ? ` · Blocked ${since}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.unblockBtn}
            onPress={() => unblock(item)}
            disabled={Boolean(unblocking)}
            activeOpacity={0.8}
          >
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.unblockText}>Unblock</Text>}
          </TouchableOpacity>
        </View>
      );
    },
    [unblocking, unblock]
  );

  const renderBody = () => {
    if (loadError && !blocked) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{loadError}</Text>
          <TouchableOpacity style={styles.unblockBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.unblockText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!blocked) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={ORANGE} />
        </View>
      );
    }
    if (blocked.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={36} color="#3F3F46" />
          <Text style={styles.emptyTitle}>No blocked hunters</Text>
          <Text style={styles.emptyText}>Hunters you block are hidden from your leaderboard and listed here.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={blocked}
        keyExtractor={(h) => h.userId}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListHeaderComponent={
          <Text style={styles.note}>
            Blocked hunters are hidden from your leaderboard and can't send you friend requests.
          </Text>
        }
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Screen style={styles.screen}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Hunters</Text>
          <View style={styles.headerSpacer} />
        </View>
        {renderBody()}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242428',
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 38,
  },
  listContent: {
    padding: 16,
    paddingBottom: 60,
  },
  note: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#71717A',
    marginBottom: 16,
    marginHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18181B',
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  meta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  unblockBtn: {
    minWidth: 88,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#242428',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
  },
});
