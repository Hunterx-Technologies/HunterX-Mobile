import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image as RNImage,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  acceptFriendRequest,
  addFriendByInviteLink,
  blockHunter,
  cancelFriendRequest,
  declineFriendRequest,
  fetchHunterCard,
  fetchHunterCardByCode,
  removeFriend,
  sendFriendRequest,
  unblockHunter,
} from '@/services/api/friends.service';
import { getApiErrorCode } from '@/services/api/errors';
import { useFriendsStore } from '@/store/useFriendsStore';
import { showGlobalToast } from '@/store/useToastStore';
import { fontFamilies } from '@/theme/typography';
import type { FriendRelationship, HunterCard, HunterCardPreview } from '@/types/friends';

// Same artwork and vignette as the leaderboard share pop-up (LeaderboardTop5Modal).
const CARD_BG = require('@/assets/images/top5bg.jpg');
const VIGNETTE_COLORS = ['rgba(2, 2, 3, 0.78)', 'rgba(2, 2, 3, 0.4)', 'rgba(2, 2, 3, 0.7)', '#020203'] as const;
const VIGNETTE_LOCATIONS = [0, 0.25, 0.65, 1] as const;
const FALLBACK_AVATAR = 'https://res.cloudinary.com/sc8zzixt/image/upload/w_96,h_96,c_fill/f_auto,q_auto/v1788468328/hunterx/app-assets/arise_avatar_11.jpg';
const ORANGE = '#FE5B01';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Which hunter to show:
 *  id    tapped on the leaderboard (preview = the row, so it opens instantly)
 *  code  a pasted invite code → Add friend sends a request
 *  link  an invite link opened while signed in → Add friend makes you friends now
 */
export type HunterCardTarget =
  | { kind: 'id'; userId: string; preview?: HunterCardPreview }
  | { kind: 'code'; code: string }
  | { kind: 'link'; code: string };

type Props = {
  target: HunterCardTarget | null;
  onClose: () => void;
  /** After Add friend on an invite link succeeded (the screen moves on to Friends). */
  onBecameFriends?: (card: HunterCard) => void;
};

type Pending = 'remove' | 'block' | null;

function formatJoined(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** "Nov" and "2026", for the Joined stat, which shows them on two lines. */
function joinedParts(iso: string | null | undefined): { month: string; year: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { month: d.toLocaleDateString('en-IN', { month: 'short' }), year: String(d.getFullYear()) };
}

const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * A hunter's card: avatar, level, XP, streaks, when they joined, and the
 * friend button for how you stand with them. One instance per screen; open
 * it by setting `target`. The card is cached in useFriendsStore, so opening
 * the same hunter again this session is instant.
 */
export function HunterCardModal({ target, onClose, onBecameFriends }: Props) {
  const cached = useFriendsStore((s) => (target?.kind === 'id' ? s.cards[target.userId] : undefined));
  const rememberCard = useFriendsStore((s) => s.rememberCard);
  const applyRelationship = useFriendsStore((s) => s.applyRelationship);

  const [card, setCard] = useState<HunterCard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!target) return;
    const mine = ++requestId.current;
    setLoadError(null);
    try {
      const next = target.kind === 'id' ? await fetchHunterCard(target.userId) : await fetchHunterCardByCode(target.code);
      if (mine !== requestId.current) return;
      rememberCard(next);
      setCard(next);
    } catch (err) {
      if (mine !== requestId.current) return;
      setLoadError(err instanceof Error && err.message ? err.message : 'Could not load this hunter.');
    }
  }, [target, rememberCard]);

  // A new target: show what we already have (cache, then the row), refresh in the background.
  useEffect(() => {
    if (!target) {
      requestId.current += 1;
      setCard(null);
      setLoadError(null);
      setPending(null);
      return;
    }
    setCard(target.kind === 'id' && cached ? cached : null);
    load();
    // Only when the target changes; `cached` is just the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const preview = target?.kind === 'id' ? target.preview : undefined;
  const name = card?.name ?? preview?.name ?? '';
  const avatar = card?.avatarThumbUrl ?? preview?.avatarThumbUrl ?? null;
  const level = card?.level ?? preview?.level ?? 1;
  const totalXp = card?.totalXp ?? preview?.totalXp ?? 0;
  const streak = card?.streak ?? preview?.streak ?? 0;
  const joined = joinedParts(card?.joinedAt);
  const friendsSince = formatJoined(card?.friendsSince);
  const relationship: FriendRelationship | null = card?.relationship ?? null;
  const hasSomething = Boolean(card || preview);

  const act = useCallback(
    async (run: (userId: string) => Promise<{ relationship: FriendRelationship }>, toast?: string) => {
      if (!card || busy) return;
      setBusy(true);
      Haptics.selectionAsync().catch(() => {});
      try {
        const { relationship: next } = await run(card.userId);
        const updated = { ...card, relationship: next, friendsSince: next === 'friends' ? new Date().toISOString() : null };
        setCard(updated);
        // Store first: it compares with the cached card to know whether the
        // Friends leaderboard changed (e.g. friends → none), then cache the new one.
        applyRelationship(card.userId, next);
        rememberCard(updated);
        if (toast) showGlobalToast(toast, 'success');
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.';
        showGlobalToast(message, 'error');
        // The other side may have changed it (accepted, cancelled) — show what's true now.
        if (getApiErrorCode(err) === 'NO_PENDING_REQUEST') load();
      } finally {
        setBusy(false);
      }
    },
    [card, busy, rememberCard, applyRelationship, load]
  );

  const addViaLink = useCallback(async () => {
    if (!card || busy || target?.kind !== 'link') return;
    setBusy(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      await addFriendByInviteLink(target.code);
      const updated = { ...card, relationship: 'friends' as const, friendsSince: new Date().toISOString() };
      setCard(updated);
      applyRelationship(card.userId, 'friends');
      rememberCard(updated);
      showGlobalToast(`You and ${card.name} are now friends.`, 'success');
      onBecameFriends?.(updated);
    } catch (err) {
      showGlobalToast(err instanceof Error && err.message ? err.message : 'Could not add this friend.', 'error');
    } finally {
      setBusy(false);
    }
  }, [card, busy, target, rememberCard, applyRelationship, onBecameFriends]);

  const confirmPending = useCallback(async () => {
    const which = pending;
    setPending(null);
    if (which === 'remove') await act(removeFriend, 'Removed from your friends.');
    if (which === 'block') await act(blockHunter, `${name} is blocked.`);
  }, [pending, act, name]);

  const renderActions = () => {
    if (loadError) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!relationship) {
      return (
        <View style={styles.actionsLoading}>
          <ActivityIndicator color={ORANGE} />
        </View>
      );
    }
    if (relationship === 'self') {
      return <Text style={styles.noteText}>This is you.</Text>;
    }
    if (relationship === 'blocked') {
      return (
        <>
          <Text style={styles.noteText}>You blocked this hunter. They can't send you requests.</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => act(unblockHunter, 'Unblocked.')} disabled={busy} activeOpacity={0.8}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.secondaryBtnText}>Unblock</Text>}
          </TouchableOpacity>
        </>
      );
    }
    if (relationship === 'incoming') {
      return (
        <>
          <Text style={styles.noteText}>{name} wants to be your friend.</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.flex1]}
              onPress={() => act(declineFriendRequest)}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityLabel={`Decline ${name}'s friend request`}
            >
              <Text style={styles.secondaryBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.flex1]}
              onPress={() => act(acceptFriendRequest, `You and ${name} are now friends.`)}
              disabled={busy}
              activeOpacity={0.85}
              accessibilityLabel={`Accept ${name}'s friend request`}
            >
              {busy ? <ActivityIndicator color="#000000" /> : <Text style={styles.primaryBtnText}>Accept</Text>}
            </TouchableOpacity>
          </View>
        </>
      );
    }
    if (relationship === 'friends') {
      return (
        <View style={styles.friendsBadge}>
          <Ionicons name="people" size={16} color={ORANGE} />
          <Text style={styles.friendsBadgeText}>Friends{friendsSince ? ` since ${friendsSince}` : ''}</Text>
        </View>
      );
    }
    if (relationship === 'requested') {
      return (
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => act(cancelFriendRequest)}
          disabled={busy}
          activeOpacity={0.8}
          accessibilityLabel="Request sent. Tap to cancel it."
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.row}>
              <Ionicons name="time-outline" size={16} color="#C9D1D9" />
              <Text style={styles.secondaryBtnText}>Requested · Tap to cancel</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }
    // none
    return (
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={target?.kind === 'link' ? addViaLink : () => act(sendFriendRequest, 'Friend request sent.')}
        disabled={busy}
        activeOpacity={0.85}
        accessibilityLabel={`Add ${name} as a friend`}
      >
        {busy ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <View style={styles.row}>
            <Ionicons name="person-add" size={16} color="#000000" />
            <Text style={styles.primaryBtnText}>Add friend</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const showMore = relationship === 'friends' || relationship === 'none' || relationship === 'requested' || relationship === 'incoming';

  return (
    <Modal visible={target !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        {/* Inner Pressable swallows taps so only the backdrop closes the card. */}
        <Pressable style={styles.card} onPress={() => {}}>
          {/* RN Image: bundled artwork, drawn immediately (same as the share pop-up). */}
          <RNImage source={CARD_BG} style={styles.bgImage} resizeMode="cover" />
          <LinearGradient colors={VIGNETTE_COLORS} locations={VIGNETTE_LOCATIONS} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

          <View style={styles.headerBar}>
            <View style={styles.headerSide} />
            <Text style={styles.headerTitle}>Hunter</Text>
            <TouchableOpacity style={styles.headerSide} onPress={onClose} hitSlop={12} activeOpacity={0.7} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {!hasSomething && !loadError ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={ORANGE} />
              </View>
            ) : (
              <View style={styles.mainCard}>
                {hasSomething ? (
                  <>
                    <View style={styles.avatarRing}>
                      <Image source={{ uri: avatar || FALLBACK_AVATAR }} style={styles.avatar} contentFit="cover" />
                      {preview?.rank != null ? (
                        <View style={styles.rankPill}>
                          <Text style={styles.rankPillText}>#{preview.rank}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    {card?.rankName ? <Text style={styles.rankName}>{card.rankName}</Text> : null}

                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreNumber}>{fmt(totalXp)} </Text>
                      <Text style={styles.scoreXp}>XP</Text>
                    </View>
                    <View style={styles.levelPill}>
                      <Text style={styles.levelPrefix}>Level </Text>
                      <Text style={styles.levelNumber}>{level}</Text>
                    </View>

                    <View style={styles.statsRow}>
                      <Stat icon={<FontAwesome5 name="fire" size={14} color={streak > 0 ? ORANGE : '#5B6470'} />} value={`${streak}`} label="Streak" />
                      <View style={styles.statDivider} />
                      <Stat icon={<Ionicons name="trophy" size={14} color="#F6B23C" />} value={card ? `${card.longestStreak}` : '–'} label="Best streak" />
                      <View style={styles.statDivider} />
                      <Stat icon={<Ionicons name="calendar" size={14} color="#8D98A3" />} value={joined?.month ?? '–'} subValue={joined?.year} label="Joined" />
                    </View>
                  </>
                ) : null}

                <View style={styles.actions}>{renderActions()}</View>
              </View>
            )}

            {showMore && card ? (
              <View style={styles.moreRow}>
                {relationship === 'friends' ? (
                  <TouchableOpacity onPress={() => setPending('remove')} disabled={busy} hitSlop={8}>
                    <Text style={styles.moreText}>Remove friend</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setPending('block')} disabled={busy} hitSlop={8}>
                  <Text style={[styles.moreText, styles.moreDanger]}>Block</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Pressable>

      {/* Inside the card's Modal so it opens on top of it. */}
      <ConfirmDialog
        visible={pending !== null}
        title={pending === 'block' ? `Block ${name}?` : `Remove ${name}?`}
        message={
          pending === 'block'
            ? 'You won\'t be friends, and neither of you can send the other a request. They aren\'t told. You can unblock them from their card.'
            : 'They\'ll leave your Friends leaderboard. They aren\'t told.'
        }
        confirmLabel={pending === 'block' ? 'Block' : 'Remove'}
        destructive
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </Modal>
  );
}

/** subValue: an optional second line under the value (Joined: "Nov" / "2026"). */
function Stat({ icon, value, subValue, label }: { icon: React.ReactNode; value: string; subValue?: string; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {icon}
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      </View>
      {subValue ? <Text style={styles.statValue} numberOfLines={1}>{subValue}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  card: {
    width: '100%',
    maxWidth: 355,
    maxHeight: SCREEN_HEIGHT * 0.9,
    backgroundColor: '#020203',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: 'rgba(254, 91, 1, 0.50)',
    overflow: 'hidden',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  headerBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  headerSide: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  body: {
    paddingHorizontal: 22,
    paddingBottom: 18,
  },
  loadingBlock: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCard: {
    backgroundColor: 'rgba(13, 17, 20, 0.85)',
    borderRadius: 18,
    borderWidth: 1.1,
    borderColor: 'rgba(254, 91, 1, 0.45)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  avatarRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1.8,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1114',
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  rankPill: {
    position: 'absolute',
    top: -2,
    right: -10,
    minWidth: 30,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    backgroundColor: '#180A04',
    borderWidth: 1.2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankPillText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  name: {
    marginTop: 10,
    fontFamily: fontFamilies.bold,
    fontSize: 19,
    color: '#FFFFFF',
    maxWidth: '100%',
  },
  rankName: {
    marginTop: 2,
    fontFamily: fontFamilies.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#8D98A3',
    textTransform: 'uppercase',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
  },
  scoreNumber: {
    fontFamily: fontFamilies.bold,
    fontSize: 21,
    color: '#FFFFFF',
  },
  scoreXp: {
    fontFamily: fontFamilies.bold,
    fontSize: 14.5,
    color: ORANGE,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 10, 4, 0.75)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 8,
  },
  levelPrefix: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    color: '#8D98A3',
  },
  levelNumber: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignSelf: 'stretch',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  statLabel: {
    marginTop: 3,
    fontFamily: fontFamilies.medium,
    fontSize: 10.5,
    color: '#8D98A3',
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: 16,
    gap: 10,
  },
  actionsLoading: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  flex1: {
    flex: 1,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 23,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#000000',
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  friendsBadge: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.55)',
    backgroundColor: 'rgba(24, 10, 4, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  friendsBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  noteText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#C9D1D9',
    textAlign: 'center',
  },
  errorBox: {
    alignItems: 'stretch',
    gap: 10,
  },
  errorText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13.5,
    color: '#F4A5A5',
    textAlign: 'center',
  },
  moreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginTop: 14,
  },
  moreText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#8D98A3',
  },
  moreDanger: {
    color: '#EF4444',
  },
});
