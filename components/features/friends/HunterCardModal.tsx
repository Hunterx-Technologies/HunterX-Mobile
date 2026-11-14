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
const DANGER = '#EF4444';
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
  const joined = formatJoined(card?.joinedAt);
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

  const blockButton = (
    <TouchableOpacity
      style={[styles.dangerBtn, styles.flex1]}
      onPress={() => setPending('block')}
      disabled={busy}
      activeOpacity={0.8}
      accessibilityLabel={`Block ${name}`}
    >
      <View style={styles.row}>
        <Ionicons name="ban-outline" size={19} color={DANGER} />
        <Text style={styles.dangerBtnText} numberOfLines={1}>Block User</Text>
      </View>
    </TouchableOpacity>
  );

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
          <View style={styles.buttonRow}>
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
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Accept</Text>}
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.linkBtn} onPress={() => setPending('block')} disabled={busy} hitSlop={8}>
            <Text style={[styles.linkText, styles.linkDanger]}>Block User</Text>
          </TouchableOpacity>
        </>
      );
    }

    let primary: React.ReactNode;
    if (relationship === 'friends') {
      primary = (
        <View style={[styles.friendsBadge, styles.flex1]}>
          <Ionicons name="people" size={18} color={ORANGE} />
          <Text style={styles.friendsBadgeText} numberOfLines={1}>Friends</Text>
        </View>
      );
    } else if (relationship === 'requested') {
      primary = (
        <TouchableOpacity
          style={[styles.secondaryBtn, styles.flex1]}
          onPress={() => act(cancelFriendRequest)}
          disabled={busy}
          activeOpacity={0.8}
          accessibilityLabel="Request sent. Tap to cancel it."
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.row}>
              <Ionicons name="time-outline" size={18} color="#C9D1D9" />
              <Text style={styles.secondaryBtnText}>Requested</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    } else {
      // none
      primary = (
        <TouchableOpacity
          style={[styles.primaryBtn, styles.flex1]}
          onPress={target?.kind === 'link' ? addViaLink : () => act(sendFriendRequest, 'Friend request sent.')}
          disabled={busy}
          activeOpacity={0.85}
          accessibilityLabel={`Add ${name} as a friend`}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.row}>
              <Ionicons name="person-add" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText} numberOfLines={1}>Add Friend</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <>
        <View style={styles.buttonRow}>
          {primary}
          {blockButton}
        </View>
        {relationship === 'friends' ? (
          <View style={styles.friendsFooter}>
            {friendsSince ? <Text style={styles.footerText}>Friends since {friendsSince}</Text> : null}
            <TouchableOpacity onPress={() => setPending('remove')} disabled={busy} hitSlop={8}>
              <Text style={styles.linkText}>Remove friend</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </>
    );
  };

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
            <Text style={styles.headerTitle}>Hunter Profile</Text>
            <TouchableOpacity style={styles.headerSide} onPress={onClose} hitSlop={12} activeOpacity={0.7} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {!hasSomething && !loadError ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={ORANGE} />
              </View>
            ) : (
              <>
                {hasSomething ? (
                  <>
                    {/* Avatar on the left; name, rank, XP and level beside it. */}
                    <View style={styles.identityRow}>
                      <View style={styles.avatarRing}>
                        <Image source={{ uri: avatar || FALLBACK_AVATAR }} style={styles.avatar} contentFit="cover" />
                        {preview?.rank != null ? (
                          <View style={styles.rankPill}>
                            <Text style={styles.rankPillText} numberOfLines={1}>#{preview.rank}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.identityRight}>
                        <View style={styles.nameBlock}>
                          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{name}</Text>
                          {card?.rankName ? <Text style={styles.rankName} numberOfLines={1}>{card.rankName}</Text> : null}
                        </View>

                        <View style={styles.xpCard}>
                          <View style={styles.xpGroup}>
                            <Ionicons name="flash" size={18} color={ORANGE} />
                            <Text style={styles.xpNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                              {fmt(totalXp)}<Text style={styles.xpUnit}> XP</Text>
                            </Text>
                          </View>
                          <View style={styles.xpDivider} />
                          <View style={styles.levelPill}>
                            <Text style={styles.levelPrefix}>Level </Text>
                            <Text style={styles.levelNumber}>{level}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.statsBox}>
                      <Stat icon={<FontAwesome5 name="fire" size={20} color={streak > 0 ? ORANGE : '#5B6470'} />} value={`${streak}`} label="Streak" />
                      <View style={styles.statDivider} />
                      <Stat icon={<Ionicons name="trophy" size={22} color="#F6B23C" />} value={card ? `${card.longestStreak}` : '–'} label="Best Streak" />
                      <View style={styles.statDivider} />
                      <Stat icon={<Ionicons name="calendar" size={20} color="#8D98A3" />} value={joined ?? '–'} label="Joined" />
                    </View>
                  </>
                ) : null}

                <View style={styles.actions}>{renderActions()}</View>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>

      {/* Inside the card's Modal so it opens on top of it. */}
      <ConfirmDialog
        visible={pending !== null}
        title={pending === 'block' ? `Block ${name}?` : `Remove ${name}?`}
        message={
          pending === 'block'
            ? 'You won\'t be friends, and neither of you can send the other a request. They aren\'t told, and they\'re hidden from your leaderboard. You can unblock them in Settings → Blocked hunters.'
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

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: SCREEN_HEIGHT * 0.9,
    backgroundColor: '#0B0B0D',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: ORANGE,
    overflow: 'hidden',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  headerBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginTop: 4,
  },
  headerSide: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 19,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  body: {
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  loadingBlock: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Identity: avatar + name/rank + XP/level
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  avatarRing: {
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 2.5,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1114',
    shadowColor: ORANGE,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  rankPill: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 38,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 15,
    backgroundColor: '#140804',
    borderWidth: 1.5,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankPillText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  identityRight: {
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  nameBlock: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.18)',
    paddingLeft: 12,
  },
  name: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: '#FFFFFF',
  },
  rankName: {
    marginTop: 2,
    fontFamily: fontFamilies.semiBold,
    fontSize: 11.5,
    letterSpacing: 2.2,
    color: '#8D98A3',
    textTransform: 'uppercase',
  },
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(28, 20, 16, 0.85)',
  },
  xpGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  xpNumber: {
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    color: '#FFFFFF',
  },
  xpUnit: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: ORANGE,
  },
  xpDivider: {
    width: 1,
    height: 22,
    marginHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelPrefix: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#C9D1D9',
  },
  levelNumber: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Stats
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    backgroundColor: 'rgba(22, 22, 25, 0.9)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statIcon: {
    height: 24,
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  statLabel: {
    marginTop: 3,
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#A1A1AA',
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },

  // Actions
  actions: {
    alignSelf: 'stretch',
    marginTop: 20,
    gap: 12,
  },
  actionsLoading: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
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
    height: 52,
    borderRadius: 26,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15.5,
    color: '#FFFFFF',
  },
  dangerBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.3,
    borderColor: DANGER,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dangerBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15.5,
    color: DANGER,
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  friendsBadge: {
    height: 52,
    borderRadius: 26,
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
    fontSize: 15.5,
    color: '#FFFFFF',
  },
  friendsFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  footerText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    color: '#8D98A3',
  },
  linkBtn: {
    alignSelf: 'center',
  },
  linkText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#8D98A3',
    textDecorationLine: 'underline',
  },
  linkDanger: {
    color: DANGER,
    textDecorationLine: 'none',
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
});
