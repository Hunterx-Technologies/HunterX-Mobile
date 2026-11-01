import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';

import type { QuestItem } from '@/utils/quests';
import ViewShot from '@/components/common/ViewShotCompat';
import {
  BURST,
  Blob,
  BurstEmber,
  CHARGE_SPARKS,
  ChargeSpark,
  RISING,
  Rays,
  RisingEmber,
} from '@/components/features/streaks/DayCompleteCelebration';
import { FLAME_ASPECT, FLAME_COLORS_UNLIT, StreakFlame } from '@/components/features/streaks/StreakFlame';
import { getAvatarSource } from '@/components/profile/AvatarSelectionModal';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentUser } from '@/services/api/auth.service';
import { fetchLeaderboardPage } from '@/services/api/leaderboard.service';
import { useAuthStore } from '@/store/useAuthStore';
import RNShare from '@/services/share/RNShare';
import { useSettingsStore } from '@/store/useSettingsStore';
import { fontFamilies } from '@/theme/typography';
import type { LeaderboardEntry, LeaderboardMe } from '@/types/leaderboard';
import type { ViewShotHandle } from '@/types/viewShot';
import type { WeekStatusDay } from '@/types/user';

// The page shown when the hunter clears the day's missions (also on
// Profile → Developer → Mission Clear Test).
//
// It opens like the day-complete streak screen: on a dark screen the grey
// flame charges, ignites with warm light and rays, and the count rolls up.
// The flame and count then shrink and glide up into the page's hero, and the
// rest of the page fades in below, scrollable. Laid out like the results
// page after a LinkedIn game: the streak up top with this week's days, a row
// of stats, how they compare with friends and everyone else, today's
// missions, a result card to share, and when the next missions unlock.

const ORANGE = '#FE5B01';
const BG = '#0A0A0A';
const CARD = '#131316';
const CARD_BORDER = '#232328';
const MUTED = '#8A8A93';
const FALLBACK_AVATAR =
  'https://res.cloudinary.com/sc8zzixt/image/upload/w_96,h_96,c_fill/f_auto,q_auto/v1788468328/hunterx/app-assets/arise_avatar_11.jpg';

// Hero sizes on the page; the intro draws them INTRO_SCALE times bigger and
// shrinks into them, so the two line up exactly.
const FLAME_W = 64;
const FLAME_H = FLAME_W * FLAME_ASPECT;
const NUMBER_FONT = 56;
const NUMBER_H = 62;
const INTRO_SCALE = 2;
const I_FLAME_W = FLAME_W * INTRO_SCALE;
const I_FLAME_H = FLAME_H * INTRO_SCALE;
const I_NUMBER_H = NUMBER_H * INTRO_SCALE;
const I_GAP = 8;

// Intro timeline (ms).
const CHARGE_AT = 450;
const IGNITE_AT = 1250;
const ROLL_AT = 1650;
const DOCK_AT = 2500;
const DOCK_MS = 650;
const REVEAL_AT = DOCK_AT + 380;

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/** Browsers block sound until the page has been tapped once; skip it there. */
const canPlaySound = () =>
  !(Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === false);

const playOnce = (player: AudioPlayer) => {
  if (!canPlaySound()) return;
  try {
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {}
};
const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type DayState = 'done' | 'missed' | 'rest' | 'upcoming';

const isDone = (q: QuestItem) => q.status === 'done' || q.status === 'partial';
const xpOf = (q: QuestItem) => q.earnedXp ?? q.xpReward ?? 0;

/** yyyy-mm-dd in local time. */
function localDateKey(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayStateFromStatus(status: WeekStatusDay['status']): DayState {
  switch (status) {
    case 'DONE':
    case 'COMPLETED':
      return 'done';
    case 'MISSED':
    case 'FAILED':
      return 'missed';
    case 'REST':
    case 'FREEZE':
    case 'SKIPPED':
      return 'rest';
    default:
      return 'upcoming';
  }
}

/**
 * Monday-first days of this week. Today always counts as done (that's why
 * this page is showing), even if the server hasn't caught up yet. A past day
 * the server didn't report is done if the current streak reaches back to it.
 */
function buildWeek(days: WeekStatusDay[] | undefined, streak: number) {
  const today = new Date();
  const todayKey = localDateKey(today);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const byDate = new Map((days ?? []).map((d) => [d.date?.slice(0, 10), d.status]));
  const todayIndex = (today.getDay() + 6) % 7;

  return WEEK_LETTERS.map((letter, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const key = localDateKey(date);
    const isToday = key === todayKey;
    const status = byDate.get(key);
    let state: DayState = status ? dayStateFromStatus(status) : 'upcoming';
    if (isToday) state = 'done';
    else if (!status && key < todayKey) state = todayIndex - i < streak ? 'done' : 'missed';
    return { letter, key, isToday, state };
  });
}

function useCountdownToMidnight() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((midnight.getTime() - now) / 60_000));
  return `${Math.floor(mins / 60)}h ${`${mins % 60}`.padStart(2, '0')}m`;
}

/** Fades and lifts a section in after `delay` ms. */
function Reveal({ delay, children, style }: { delay: number; children: React.ReactNode; style?: any }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, [delay, p]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: 14 * (1 - p.value) }],
  }));
  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

function WeekDot({ state, isToday, letter, delay }: { state: DayState; isToday: boolean; letter: string; delay: number }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 180 }));
  }, [delay, pop]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + 0.4 * pop.value }], opacity: pop.value }));

  return (
    <View style={styles.weekCol}>
      <Text style={[styles.weekLetter, isToday && styles.weekLetterToday]}>{letter}</Text>
      <Animated.View
        style={[
          styles.weekDot,
          state === 'done' && styles.weekDotDone,
          state === 'missed' && styles.weekDotMissed,
          isToday && styles.weekDotToday,
          anim,
        ]}
      >
        {state === 'done' && <Ionicons name={isToday ? 'flame' : 'checkmark'} size={isToday ? 15 : 14} color="#FFFFFF" />}
        {state === 'missed' && <Ionicons name="close" size={13} color="#5A5A62" />}
        {state === 'rest' && <Ionicons name="snow-outline" size={12} color="#7FB5FF" />}
      </Animated.View>
    </View>
  );
}

function StatTile({ value, label, icon }: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={15} color={ORANGE} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function FriendRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View style={[styles.friendRow, entry.isMe && styles.friendRowMe]}>
      <Text style={[styles.friendRank, entry.isMe && styles.friendRankMe]}>{entry.rank ?? '–'}</Text>
      <ExpoImage
        source={{ uri: entry.avatarThumbUrl || FALLBACK_AVATAR }}
        style={styles.friendAvatar}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <Text style={styles.friendName} numberOfLines={1}>
        {entry.isMe ? 'You' : entry.name}
      </Text>
      {entry.streak != null && entry.streak > 0 && (
        <View style={styles.friendStreak}>
          <Ionicons name="flame" size={12} color={ORANGE} />
          <Text style={styles.friendStreakText}>{entry.streak}</Text>
        </View>
      )}
      <Text style={styles.friendXp}>{entry.totalXp.toLocaleString('en-US')} XP</Text>
    </View>
  );
}

export interface MissionResultsScreenProps {
  quests: QuestItem[];
  onContinue: () => void;
}

export function MissionResultsScreen({ quests, onContinue }: MissionResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const tap = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  // Today's daily missions (fall back to everything if none are typed daily).
  const daily = useMemo(() => {
    const list = (quests ?? []).filter((q) => q.type === 'daily');
    return list.length > 0 ? list : quests ?? [];
  }, [quests]);
  const doneCount = daily.filter(isDone).length;
  const totalXp = daily.filter(isDone).reduce((sum, q) => sum + xpOf(q), 0);
  const perfect = daily.length > 0 && doneCount === daily.length;

  // Everything below comes from the hunter's account (refreshed as the page
  // opens) and today's missions. Read the same way as the Profile screen.
  const progression = user?.user_progression ?? {};
  // At least 1: this page only shows on a cleared day, which counts even if
  // the server hasn't bumped the streak yet.
  const streak = Math.max(1, user?.currentStreak || progression.daily_streak || 0);
  const bestStreak = Math.max(streak, user?.longestStreak ?? progression.longest_streak ?? 0);
  const streakLives = typeof progression.streak_lives === 'number' ? progression.streak_lives : null;
  const displayName = user?.name || user?.displayName || 'Hunter';
  const avatarSource = getAvatarSource(user?.avatarUrl, (user as any)?.avatar_id);
  const isNewBest = streak > 1 && streak >= bestStreak;
  const level = progression.current_level ?? user?.level ?? 1;
  const rankName = progression.rank_name || progression.rank || progression.current_level_name || null;
  const totalXpAll = progression.total_xp ?? user?.xp ?? 0;
  const nextLevelXp = progression.next_level_xp_required ?? progression.next_level_required_xp ?? null;
  const xpToNext = nextLevelXp != null && nextLevelXp > totalXpAll ? nextLevelXp - totalXpAll : 0;

  // Pick up the streak, week and XP the server just updated for today.
  useEffect(() => {
    getCurrentUser()
      .then((fresh) => fresh && useAuthStore.getState().setUser(fresh))
      .catch(() => {});
  }, []);

  const week = useMemo(() => buildWeek(user?.week_status?.days, streak), [user?.week_status?.days, streak]);
  const nextIn = useCountdownToMidnight();

  const today = new Date();
  const dateLabel = `${DAY_NAMES[today.getDay()]}, ${MONTHS[today.getMonth()]} ${today.getDate()}`;

  // How the hunter compares: friends board plus their global percentile.
  const [friends, setFriends] = useState<LeaderboardEntry[] | null>(null);
  const [me, setMe] = useState<LeaderboardMe | null>(null);
  useEffect(() => {
    let alive = true;
    fetchLeaderboardPage('friends', null, 50)
      .then((page) => {
        if (!alive) return;
        const others = page.entries.filter((e) => !e.isMe);
        const mine = page.entries.find((e) => e.isMe);
        if (others.length === 0) return setFriends([]);
        const top = page.entries.slice(0, 3);
        setFriends(mine && !top.some((e) => e.isMe) ? [...top, mine] : top);
      })
      .catch(() => alive && setFriends([]));
    fetchLeaderboardPage('global', null, 1)
      .then((page) => alive && setMe(page.me))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Intro: the streak ignites in the centre, then docks into the hero.
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const soundEnabled = useSettingsStore((s) => s.soundEffectsEnabled);
  const igniteSound = useAudioPlayer(require('../../../assets/sounds/streak_ignite.m4a'));
  const countSound = useAudioPlayer(require('../../../assets/sounds/streak_count_up.m4a'));
  const from = Math.max(0, streak - 1);

  const [revealed, setRevealed] = useState(!!reduceMotion);
  const introGroupRef = useRef<View>(null);
  const heroTargetRef = useRef<View>(null);

  const appear = useSharedValue(0);
  const charge = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const tilt = useSharedValue(0);
  const grow = useSharedValue(0.78);
  const lit = useSharedValue(0);
  const flash = useSharedValue(0);
  const burst = useSharedValue(0);
  const roll = useSharedValue(0);
  const rays = useSharedValue(0);
  const emberClock = useSharedValue(0);
  const dock = useSharedValue(0);
  const dockX = useSharedValue(0);
  const dockY = useSharedValue(0);
  const swapped = useSharedValue(reduceMotion ? 1 : 0); // hero shown in the page, intro hidden
  const page = useSharedValue(reduceMotion ? 1 : 0); // top bar and continue button

  useEffect(() => {
    if (reduceMotion) return;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const tick = () => hapticsEnabled && Haptics.selectionAsync().catch(() => {});

    appear.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) });

    // Charge: squash and stretch while sparks gather.
    const t = (to: number, ms: number) => withTiming(to, { duration: ms, easing: Easing.inOut(Easing.quad) });
    sy.value = withDelay(
      CHARGE_AT,
      withSequence(
        t(0.84, 170), t(1.05, 150), t(0.8, 150), t(1.04, 120), t(0.72, 190),
        withTiming(1.3, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 7, stiffness: 160 })
      )
    );
    sx.value = withDelay(
      CHARGE_AT,
      withSequence(
        t(1.12, 170), t(0.97, 150), t(1.16, 150), t(0.98, 120), t(1.22, 190),
        withTiming(0.84, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 7, stiffness: 160 })
      )
    );
    tilt.value = withDelay(
      CHARGE_AT + 300,
      withSequence(...[-1, 1, -1, 1, -0.6, 0].map((to) => withTiming(to, { duration: 70 })))
    );
    charge.value = withDelay(CHARGE_AT, withTiming(1, { duration: IGNITE_AT - CHARGE_AT, easing: Easing.in(Easing.quad) }));
    at(CHARGE_AT, tick);
    at(CHARGE_AT + 320, tick);
    at(CHARGE_AT + 620, tick);

    // Ignite.
    lit.value = withDelay(IGNITE_AT, withTiming(1, { duration: 160 }));
    grow.value = withDelay(IGNITE_AT, withSpring(1, { damping: 9, stiffness: 140 }));
    flash.value = withDelay(IGNITE_AT, withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 520 })));
    burst.value = withDelay(IGNITE_AT, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
    rays.value = withDelay(IGNITE_AT, withRepeat(withTiming(1, { duration: 26000, easing: Easing.linear }), -1));
    emberClock.value = withDelay(IGNITE_AT, withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1));
    at(IGNITE_AT, () => {
      if (soundEnabled) playOnce(igniteSound);
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    });

    // Count up.
    roll.value = withDelay(ROLL_AT, withSpring(1, { damping: 11, stiffness: 120 }));
    at(ROLL_AT, () => {
      if (soundEnabled) playOnce(countSound);
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });

    // Dock: measure where the hero sits on the page and glide there.
    at(DOCK_AT, () => {
      const intro = introGroupRef.current;
      const target = heroTargetRef.current;
      const go = () => {
        dock.value = withTiming(1, { duration: DOCK_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
          if (finished) swapped.value = 1;
        });
        page.value = withDelay(DOCK_MS - 150, withTiming(1, { duration: 350 }));
      };
      if (!intro || !target) return go();
      intro.measureInWindow((ix, iy, iw, ih) => {
        target.measureInWindow((tx, ty, tw, th) => {
          dockX.value = tx + tw / 2 - (ix + iw / 2);
          dockY.value = ty + th / 2 - (iy + ih / 2);
          go();
        });
      });
    });
    at(REVEAL_AT, () => setRevealed(true));

    return () => timers.forEach(clearTimeout);
    // Runs once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const introGroupH = I_FLAME_H + I_GAP + I_NUMBER_H;
  const introGroupTop = height * 0.46 - introGroupH / 2;
  const flameCenterY = introGroupTop + I_FLAME_H * 0.55;
  const raySize = height * 1.25;
  const floodSize = height * 1.1;

  const introStyle = useAnimatedStyle(() => ({
    opacity: swapped.value ? 0 : appear.value,
  }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: 1 - dock.value }));
  const floodStyle = useAnimatedStyle(() => ({
    opacity: lit.value,
    transform: [{ scale: 0.3 + 0.7 * clamp01(burst.value * 1.6) }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: lit.value * (0.6 + 0.4 * clamp01(burst.value * 2)),
    transform: [{ rotate: `${rays.value * 360}deg` }, { scale: 0.6 + 0.4 * clamp01(burst.value * 1.5) }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.85 }));
  const groupStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dockX.value * dock.value },
      { translateY: dockY.value * dock.value },
      { scale: 1 - (1 - 1 / INTRO_SCALE) * dock.value },
    ],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${tilt.value * 5}deg` },
      { scaleX: sx.value * grow.value },
      { scaleY: sy.value * grow.value },
    ],
  }));
  const fxStyle = useAnimatedStyle(() => ({ opacity: 1 - dock.value }));
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  const unlitStyle = useAnimatedStyle(() => ({ opacity: 1 - lit.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.max(lit.value, charge.value * 0.35) * (1 - dock.value),
    transform: [{ scale: 0.6 + 0.4 * Math.max(lit.value, charge.value * 0.5) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: burst.value === 0 ? 0 : interpolate(burst.value, [0, 0.05, 0.6], [0, 0.9, 0], Extrapolation.CLAMP),
    transform: [{ scale: 0.3 + 2.4 * burst.value }],
  }));
  const oldNumberStyle = useAnimatedStyle(() => ({
    opacity: 1 - clamp01(roll.value * 1.5),
    transform: [{ translateY: 70 * INTRO_SCALE * 0.5 * roll.value }],
  }));
  const newNumberStyle = useAnimatedStyle(() => ({
    opacity: clamp01(roll.value * 1.5),
    transform: [
      { translateY: -70 * INTRO_SCALE * 0.5 * (1 - roll.value) },
      { scale: interpolate(roll.value, [0, 1], [0.7, 1]) },
    ],
  }));
  const heroTargetStyle = useAnimatedStyle(() => ({ opacity: swapped.value }));
  const pageStyle = useAnimatedStyle(() => ({ opacity: page.value }));

  const [showAllMissions, setShowAllMissions] = useState(false);
  const visibleMissions = showAllMissions ? daily : daily.slice(0, 4);

  // The shareable result, Wordle-style.
  const missionSquares = daily.map((q) => (isDone(q) ? '🟧' : '⬛')).join('');
  const shareText = [
    `${displayName} on HunterX · ${dateLabel}`,
    `🔥 ${streak}-day streak`,
    `${missionSquares} ${doneCount}/${daily.length} missions`,
    `+${totalXp} XP · Level ${level}`,
    'Arise, Hunter ⚔️',
  ].join('\n');

  const cardRef = useRef<ViewShotHandle>(null);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    tap();
    try {
      const uri = await cardRef.current?.capture?.();
      if (!uri) throw new Error('no image');
      await RNShare.open({ title: 'HunterX', message: shareText, url: uri, failOnCancel: false });
    } catch (error: any) {
      if (error?.message === 'User did not share') return;
      try {
        await Share.share({ message: shareText, title: 'HunterX' });
      } catch {}
    }
  };

  const handleCopy = async () => {
    tap();
    try {
      await Clipboard.setStringAsync(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const levelProgress =
    nextLevelXp && nextLevelXp > 0 ? Math.min(1, Math.max(0, totalXpAll / nextLevelXp)) : null;

  return (
    <Modal animationType="fade" transparent={false} visible onRequestClose={onContinue} statusBarTranslucent>
      <View style={styles.root}>
        <LinearGradient
          colors={['rgba(254,91,1,0.22)', 'rgba(254,91,1,0.05)', 'rgba(10,10,10,0)']}
          style={styles.topGlow}
          pointerEvents="none"
        />

        <Animated.View style={[styles.topBar, { paddingTop: insets.top + 6 }, pageStyle]}>
          <Pressable
            style={styles.iconBtn}
            hitSlop={8}
            onPress={() => {
              tap();
              onContinue();
            }}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topTitle}>Daily Missions</Text>
          <Pressable style={styles.iconBtn} hitSlop={8} onPress={handleShare} accessibilityLabel="Share">
            <Ionicons name="share-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={revealed}
        >
          {/* Hero: streak and headline */}
          <View style={styles.hero}>
            {/* Where the intro's flame and count land. */}
            <Animated.View ref={heroTargetRef} style={[styles.heroTarget, heroTargetStyle]} collapsable={false}>
              <View style={styles.heroFlame}>
                <StreakFlame width={FLAME_W} />
              </View>
              <View style={styles.heroNumberBox}>
                <Text style={styles.heroStreak}>{streak}</Text>
              </View>
            </Animated.View>
            {revealed && (
            <Reveal delay={0}>
              <Text style={styles.heroStreakLabel}>day streak</Text>
              <Text style={styles.heroTitle}>{perfect ? 'Perfect day!' : 'Day complete!'}</Text>
              <Text style={styles.heroSub}>
                {perfect
                  ? `You cleared all ${daily.length} missions today.`
                  : `You cleared ${doneCount} of ${daily.length} missions today.`}
                {isNewBest ? ' New best streak.' : ''}
              </Text>
            </Reveal>
            )}
          </View>

          {revealed && (
          <>

          {/* This week */}
          <Reveal delay={120} style={styles.card}>
            <View style={styles.weekRow}>
              {week.map((d, i) => (
                <WeekDot key={d.key} state={d.state} isToday={d.isToday} letter={d.letter} delay={220 + i * 70} />
              ))}
            </View>
            {streakLives != null && (
              <View style={styles.livesRow}>
                <Ionicons name="heart" size={13} color={streakLives > 0 ? '#FF5C6C' : '#4A4A52'} />
                <Text style={styles.livesText}>
                  {streakLives > 0
                    ? `${streakLives} streak ${streakLives === 1 ? 'life' : 'lives'} left`
                    : 'No streak lives left'}
                </Text>
              </View>
            )}
          </Reveal>

          {/* Stats */}
          <Reveal delay={220} style={styles.statsRow}>
            <StatTile icon="flash" value={`+${totalXp}`} label="XP earned" />
            <StatTile icon="checkmark-done" value={`${doneCount}/${daily.length}`} label="Missions" />
            <StatTile icon="trophy" value={`${bestStreak}`} label="Best streak" />
          </Reveal>

          {/* How you compare */}
          {(me?.topPercent != null || (friends && friends.length > 0)) && (
            <Reveal delay={320} style={styles.card}>
              <SectionTitle>How you compare</SectionTitle>
              {me?.topPercent != null && (
                <View style={styles.percentRow}>
                  <View style={styles.percentBadge}>
                    <Ionicons name="trending-up" size={16} color={ORANGE} />
                  </View>
                  <Text style={styles.percentText}>
                    You're in the <Text style={styles.percentStrong}>top {Math.max(1, Math.round(me.topPercent))}%</Text> of
                    hunters
                    {me.rank ? ` · #${me.rank.toLocaleString('en-US')}` : ''}
                  </Text>
                </View>
              )}
              {friends && friends.length > 0 && (
                <View style={styles.friendList}>
                  <Text style={styles.friendsLabel}>Friends</Text>
                  {friends.map((f) => (
                    <FriendRow key={f.userId} entry={f} />
                  ))}
                </View>
              )}
            </Reveal>
          )}

          {/* Level */}
          <Reveal delay={400} style={styles.card}>
            <View style={styles.levelRow}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{level}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.levelTitle}>
                  Level {level}
                  {rankName ? <Text style={styles.levelRank}> · {rankName}</Text> : null}
                </Text>
                {levelProgress != null ? (
                  <>
                    <View style={styles.levelTrack}>
                      <View style={[styles.levelFill, { width: `${Math.round(levelProgress * 100)}%` }]} />
                    </View>
                    <Text style={styles.levelSub}>
                      {totalXpAll.toLocaleString('en-US')} / {nextLevelXp!.toLocaleString('en-US')} XP
                      {xpToNext > 0 ? ` · ${xpToNext.toLocaleString('en-US')} to level ${level + 1}` : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.levelSub}>{totalXpAll.toLocaleString('en-US')} XP total</Text>
                )}
              </View>
            </View>
          </Reveal>

          {/* Today's missions */}
          <Reveal delay={470} style={styles.card}>
            <SectionTitle
              right={
                daily.length > 4 ? (
                  <Pressable hitSlop={8} onPress={() => setShowAllMissions((v) => !v)}>
                    <Text style={styles.sectionLink}>{showAllMissions ? 'Show less' : `See all ${daily.length}`}</Text>
                  </Pressable>
                ) : null
              }
            >
              Today's missions
            </SectionTitle>
            {visibleMissions.map((q, i) => (
              <View key={q.id} style={[styles.missionRow, i > 0 && styles.missionRowBorder]}>
                <View style={[styles.missionCheck, !isDone(q) && styles.missionCheckSkipped]}>
                  <Ionicons name={isDone(q) ? 'checkmark' : 'remove'} size={12} color={isDone(q) ? '#FFFFFF' : MUTED} />
                </View>
                <Text style={[styles.missionTitle, !isDone(q) && styles.missionTitleSkipped]} numberOfLines={1}>
                  {q.title}
                </Text>
                <Text style={[styles.missionXp, !isDone(q) && styles.missionXpSkipped]}>
                  {isDone(q) ? `+${xpOf(q)} XP` : 'Skipped'}
                </Text>
              </View>
            ))}
          </Reveal>

          {/* Share your result */}
          <Reveal delay={540}>
            <SectionTitle>Share your result</SectionTitle>
            <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }} style={styles.shareCard}>
              <LinearGradient
                colors={['#2A1206', '#140B07', '#0D0D10']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.shareCardTop}>
                <Text style={styles.shareBrand}>
                  Hunter<Text style={{ color: ORANGE }}>X</Text>
                </Text>
                <Text style={styles.shareDate}>{dateLabel}</Text>
              </View>
              <View style={styles.shareWho}>
                <ExpoImage source={avatarSource} style={styles.shareAvatar} contentFit="cover" cachePolicy="memory-disk" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.shareName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.shareRank} numberOfLines={1}>
                    Level {level}
                    {rankName ? ` · ${rankName}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.shareCardMid}>
                <View style={{ width: 34, height: 34 * FLAME_ASPECT }}>
                  <StreakFlame width={34} flicker={false} />
                </View>
                <View>
                  <Text style={styles.shareStreak}>{streak}-day streak</Text>
                  <Text style={styles.shareSub}>
                    {doneCount}/{daily.length} missions · +{totalXp} XP
                  </Text>
                </View>
              </View>
              <View style={styles.shareSquares}>
                {daily.map((q) => (
                  <View key={q.id} style={[styles.shareSquare, !isDone(q) && styles.shareSquareOff]} />
                ))}
              </View>
              <Text style={styles.shareFooter}>Best streak {bestStreak} {bestStreak === 1 ? 'day' : 'days'} · Arise, Hunter</Text>
            </ViewShot>

            <View style={styles.shareActions}>
              <Pressable style={[styles.shareAction, styles.shareActionPrimary]} onPress={handleShare}>
                <Ionicons name="share-social" size={17} color="#FFFFFF" />
                <Text style={styles.shareActionPrimaryText}>Share</Text>
              </Pressable>
              <Pressable style={styles.shareAction} onPress={handleCopy}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={17} color="#FFFFFF" />
                <Text style={styles.shareActionText}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
          </Reveal>

          {/* Next missions */}
          <Reveal delay={600} style={styles.nextRow}>
            <Ionicons name="time-outline" size={16} color={MUTED} />
            <Text style={styles.nextText}>
              New missions in <Text style={styles.nextStrong}>{nextIn}</Text>
            </Text>
          </Reveal>
          </>
          )}
        </ScrollView>

        {/* Sticky continue */}
        <Animated.View style={[styles.bottomBarWrap, pageStyle]} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(10,10,10,0)', BG, BG]}
          locations={[0, 0.35, 1]}
          style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.continueBtn}
            onPress={() => {
              tap();
              onContinue();
            }}
          >
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>
        </LinearGradient>
        </Animated.View>

        {/* Intro: the streak ignites in the centre, then docks into the hero. */}
        {!reduceMotion && (
          <Animated.View style={[StyleSheet.absoluteFill, introStyle]} pointerEvents="none">
            <Animated.View style={[StyleSheet.absoluteFill, styles.introBg, lightStyle]} />
            <Animated.View style={[styles.lightOrigin, { top: flameCenterY }, lightStyle]}>
              <Animated.View style={[styles.lightLayer, { width: floodSize, height: floodSize }, floodStyle]}>
                <Blob size={floodSize} color="#FF5A00" opacity={0.42} id="mr-flood" />
              </Animated.View>
              <Animated.View style={[styles.lightLayer, { width: raySize, height: raySize }, raysStyle]}>
                <Rays size={raySize} />
              </Animated.View>
            </Animated.View>

            <Animated.View
              ref={introGroupRef}
              collapsable={false}
              style={[styles.introGroup, { top: introGroupTop, width, height: introGroupH }, groupStyle]}
            >
              <View style={styles.introFlameStage}>
                <Animated.View style={[styles.lightLayer, styles.introGlow, glowStyle]}>
                  <Blob size={300} color="#FF6A00" opacity={0.55} id="mr-glow" />
                </Animated.View>
                <Animated.View style={[styles.fxOrigin, fxStyle]}>
                  <Animated.View style={[styles.ring, ringStyle]} />
                  {CHARGE_SPARKS.map((sp, i) => (
                    <ChargeSpark key={i} charge={charge} {...sp} />
                  ))}
                  {BURST.map((b, i) => (
                    <BurstEmber key={i} burst={burst} {...b} />
                  ))}
                  {RISING.map((r, i) => (
                    <RisingEmber key={i} clock={emberClock} lit={lit} {...r} />
                  ))}
                </Animated.View>
                <Animated.View style={[styles.introFlame, flameStyle]}>
                  <Animated.View style={[StyleSheet.absoluteFill, unlitStyle]}>
                    <StreakFlame width={I_FLAME_W} colors={FLAME_COLORS_UNLIT} flicker={false} />
                  </Animated.View>
                  <Animated.View style={[StyleSheet.absoluteFill, litStyle]}>
                    <StreakFlame width={I_FLAME_W} />
                  </Animated.View>
                </Animated.View>
              </View>
              <View style={styles.introNumberBox}>
                <Animated.Text style={[styles.introNumber, styles.introNumberOld, oldNumberStyle]}>{from}</Animated.Text>
                <Animated.Text style={[styles.introNumber, newNumberStyle]}>{streak}</Animated.Text>
              </View>
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    ...(Platform.OS === 'web' ? { overflow: 'hidden' as const } : null),
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 4,
    zIndex: 5,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 12,
  },

  /* Hero */
  hero: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  heroTarget: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  heroFlame: {
    width: FLAME_W,
    height: FLAME_H,
    marginBottom: I_GAP / INTRO_SCALE,
  },
  heroNumberBox: {
    height: NUMBER_H,
    justifyContent: 'center',
  },
  heroStreak: {
    fontFamily: fontFamilies.bold,
    fontSize: NUMBER_FONT,
    lineHeight: NUMBER_H,
    letterSpacing: -1,
    color: '#FFFFFF',
  },
  heroStreakLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: ORANGE,
    marginTop: -2,
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  /* Intro */
  introBg: {
    backgroundColor: '#020203',
  },
  lightOrigin: {
    position: 'absolute',
    left: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introGroup: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
  },
  introFlameStage: {
    width: I_FLAME_W,
    height: I_FLAME_H,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: I_GAP,
  },
  introGlow: {
    width: 300,
    height: 300,
  },
  introFlame: {
    width: I_FLAME_W,
    height: I_FLAME_H,
    transformOrigin: 'bottom',
  },
  fxOrigin: {
    position: 'absolute',
    left: I_FLAME_W / 2,
    top: I_FLAME_H * 0.62,
    width: 0,
    height: 0,
  },
  ring: {
    position: 'absolute',
    left: -60,
    top: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFC24A',
  },
  introNumberBox: {
    height: I_NUMBER_H,
    alignSelf: 'stretch',
    alignItems: 'center',
    overflow: 'hidden',
  },
  introNumber: {
    position: 'absolute',
    fontFamily: fontFamilies.bold,
    fontSize: NUMBER_FONT * INTRO_SCALE,
    lineHeight: I_NUMBER_H,
    letterSpacing: -1 * INTRO_SCALE,
    color: '#FFFFFF',
  },
  introNumberOld: {
    color: '#3A3A42',
  },
  flash: {
    backgroundColor: '#FFE2A8',
  },
  heroTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
  },
  heroSub: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },

  /* Cards */
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  sectionLink: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: ORANGE,
  },

  /* Week */
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  weekLetter: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    color: MUTED,
  },
  weekLetterToday: {
    color: '#FFFFFF',
  },
  weekDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1D1D22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotDone: {
    backgroundColor: ORANGE,
  },
  weekDotMissed: {
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#2A2A30',
  },
  weekDotToday: {
    borderWidth: 2,
    borderColor: '#FFB27A',
  },

  livesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  livesText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: MUTED,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    color: '#FFFFFF',
    marginTop: 4,
  },
  statLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: MUTED,
  },

  /* Compare */
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  percentBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(254,91,1,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    color: '#D6D6DB',
    lineHeight: 20,
  },
  percentStrong: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
  },
  friendList: {
    marginTop: 12,
    gap: 6,
  },
  friendsLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    color: MUTED,
    marginBottom: 2,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  friendRowMe: {
    backgroundColor: 'rgba(254,91,1,0.10)',
  },
  friendRank: {
    width: 22,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
  },
  friendRankMe: {
    color: ORANGE,
  },
  friendAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#222',
  },
  friendName: {
    flex: 1,
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  friendStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  friendStreakText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  friendXp: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: MUTED,
    minWidth: 64,
    textAlign: 'right',
  },

  /* Level */
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(254,91,1,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254,91,1,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: ORANGE,
  },
  levelTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  levelRank: {
    fontFamily: fontFamilies.medium,
    color: MUTED,
  },
  levelTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#24242A',
    overflow: 'hidden',
    marginTop: 8,
  },
  levelFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  levelSub: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: MUTED,
    marginTop: 6,
  },

  /* Missions */
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  missionRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A30',
  },
  missionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionCheckSkipped: {
    backgroundColor: '#22222A',
  },
  missionTitle: {
    flex: 1,
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  missionTitleSkipped: {
    color: MUTED,
  },
  missionXp: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: ORANGE,
  },
  missionXpSkipped: {
    fontFamily: fontFamilies.medium,
    color: MUTED,
  },

  /* Share card */
  shareCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(254,91,1,0.28)',
    padding: 16,
    gap: 14,
    backgroundColor: '#120A06',
  },
  shareCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareBrand: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  shareDate: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#B9A89E',
  },
  shareWho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(254,91,1,0.6)',
    backgroundColor: '#222',
  },
  shareName: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  shareRank: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#B9A89E',
    marginTop: 1,
  },
  shareCardMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareStreak: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: '#FFFFFF',
  },
  shareSub: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#C9B8AD',
    marginTop: 2,
  },
  shareSquares: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  shareSquare: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: ORANGE,
  },
  shareSquareOff: {
    backgroundColor: '#2A2A30',
  },
  shareFooter: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#9C8E86',
  },
  shareActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  shareAction: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#33333A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareActionPrimary: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  shareActionText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  shareActionPrimaryText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  /* Next missions */
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  nextText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: MUTED,
  },
  nextStrong: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
  },

  /* Bottom bar */
  bottomBarWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  continueBtn: {
    width: '100%',
    maxWidth: 520,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#0A0A0A',
  },
});
