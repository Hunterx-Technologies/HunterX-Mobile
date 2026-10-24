import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

import { fontFamilies } from '@/theme/typography';

// Server-side thumbnail (see leaderboard.service.ts) is already a
// Cloudinary derivative sized for this exact use — rendered as-is, with
// a static fallback when a user has no avatar set, rather than routing
// through getAvatarSource()/optimizeCloudinaryUrl() which would insert
// a second, redundant transform segment on top of the one the backend
// already applied.
const FALLBACK_AVATAR = 'https://res.cloudinary.com/sc8zzixt/image/upload/w_96,h_96,c_fill/f_auto,q_auto/v1788468328/hunterx/app-assets/arise_avatar_11.jpg';
const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export interface LeaderboardHunter {
  id: string;
  rank: number | null;
  displayName: string;
  score: number;
  level: number;
  avatarUrl: string | null;
  isCurrentUser?: boolean;
  /** Current daily streak, shown under the name; hidden when unknown. */
  streak?: number | null;
}

/** The name with the user's streak count under it ("🔥 1,240"). */
const NameWithStreak: React.FC<{ name: string; streak?: number | null; nameStyle: object }> = ({ name, streak, nameStyle }) => (
  <View style={styles.nameBlock}>
    <Text style={nameStyle} numberOfLines={1}>
      {name}
    </Text>
    {typeof streak === 'number' && (
      <View style={styles.streakRow}>
        <Ionicons name="flame" size={12} color={streak > 0 ? '#FE5B01' : '#52525B'} />
        <Text style={[styles.streakText, streak === 0 && styles.streakTextNone]} numberOfLines={1}>
          {streak.toLocaleString('en-US')}
        </Text>
      </View>
    )}
  </View>
);

interface LeaderboardHunterRowProps {
  hunter: LeaderboardHunter;
  onPress?: (hunter: LeaderboardHunter) => void;
}

// ── Top 3: gold, silver and bronze ───────────────────────────
// A polished metal frame, a metal-tinted card, a light sweep that runs
// across every few seconds (1st, 2nd, 3rd in turn) and the rank icon in a
// metal coin that glows. The crown also floats and sparkles. Motion is
// skipped when the device asks for reduced motion.

type Metal = {
  /** Metal text/icon color. */
  accent: string;
  /** Frame: light catching the edge of polished metal. */
  frame: readonly [string, string, ...string[]];
  /** Card body, metal-tinted on the left fading to dark. */
  body: readonly [string, string, ...string[]];
  /** The coin behind the rank icon. */
  coin: readonly [string, string, ...string[]];
  /** Icon on the coin. */
  coinIcon: string;
  glow: string;
  shine: string;
  levelBg: string;
  levelBorder: string;
  icon: 'crown' | 'medal' | 'award';
};

const METALS: Record<1 | 2 | 3, Metal> = {
  1: {
    accent: '#FFD54A',
    frame: ['#FFF4B8', '#F5C542', '#B8860B', '#FFE58A', '#8B6508', '#F5C542'],
    body: ['#6B4E06', '#3D2C04', '#171103', '#0B0802'],
    coin: ['#FFF1A8', '#F2C230', '#A87A06'],
    coinIcon: '#5A3F00',
    glow: '#FFC83D',
    shine: 'rgba(255, 245, 200, 0.42)',
    levelBg: 'rgba(255, 213, 74, 0.12)',
    levelBorder: 'rgba(255, 213, 74, 0.45)',
    icon: 'crown',
  },
  2: {
    accent: '#E6ECF2',
    frame: ['#FFFFFF', '#C9D1DA', '#7D8794', '#EEF2F6', '#5F6875', '#C9D1DA'],
    body: ['#4C545F', '#2A2F37', '#121418', '#090A0D'],
    coin: ['#FFFFFF', '#C3CBD5', '#7A8491'],
    coinIcon: '#2F3640',
    glow: '#D7DEE7',
    shine: 'rgba(255, 255, 255, 0.38)',
    levelBg: 'rgba(230, 236, 242, 0.08)',
    levelBorder: 'rgba(230, 236, 242, 0.40)',
    icon: 'medal',
  },
  3: {
    accent: '#E9A464',
    frame: ['#FFD8AE', '#D08A45', '#8A4F1E', '#F2B57E', '#6B3A14', '#D08A45'],
    body: ['#6A3D19', '#3D220D', '#170D05', '#0B0603'],
    coin: ['#FFD3A1', '#C97E3A', '#7E4618'],
    coinIcon: '#4A2508',
    glow: '#E59650',
    shine: 'rgba(255, 220, 185, 0.36)',
    levelBg: 'rgba(233, 164, 100, 0.10)',
    levelBorder: 'rgba(233, 164, 100, 0.42)',
    icon: 'award',
  },
};

const SHINE_WIDTH = 70;
const SHINE_EVERY_MS = 3600;

const Top3Card: React.FC<{
  hunter: LeaderboardHunter;
  rank: 1 | 2 | 3;
  onPress?: (hunter: LeaderboardHunter) => void;
  formatScore: (val: number) => string;
}> = ({ hunter, rank, onPress, formatScore }) => {
  const metal = METALS[rank];
  const reduceMotion = useReducedMotion();
  const [cardWidth, setCardWidth] = React.useState(0);

  const shine = useSharedValue(0);
  const pulse = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    // 1st, 2nd and 3rd sweep one after another, then all wait for the next round.
    shine.value = withDelay(
      400 + (rank - 1) * 450,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
          withTiming(1, { duration: SHINE_EVERY_MS - 900 }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    float.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduceMotion, rank, shine, pulse, float]);

  const shineStyle = useAnimatedStyle(() => ({
    opacity: shine.value > 0 && shine.value < 1 ? 1 : 0,
    transform: [
      { translateX: interpolate(shine.value, [0, 1], [-SHINE_WIDTH * 1.5, cardWidth + SHINE_WIDTH]) },
      { skewX: '-22deg' },
    ],
  }));
  const coinGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.22 }],
  }));
  const crownStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rank === 1 ? -1.5 * float.value : 0 }, { rotate: rank === 1 ? `${(float.value - 0.5) * 6}deg` : '0deg' }],
  }));
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.6, 1], [0, 0.2, 1]),
    transform: [{ scale: 0.5 + pulse.value * 0.6 }, { rotate: `${pulse.value * 90}deg` }],
  }));

  const content = (
    <View style={[styles.top3Shadow, { shadowColor: metal.glow }]}>
      <LinearGradient colors={metal.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.top3Frame}>
        <LinearGradient
          colors={metal.body}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.top3Card}
          onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
        >
          {/* Top-edge sheen, like light on polished metal */}
          <LinearGradient
            colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Rank coin + number */}
          <View style={styles.rankCol}>
            <View style={styles.coinWrap}>
              <Animated.View style={[styles.coinGlow, { backgroundColor: metal.glow }, coinGlowStyle]} />
              <Animated.View style={crownStyle}>
                <LinearGradient colors={metal.coin} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.coin}>
                  <FontAwesome5 name={metal.icon} size={12} color={metal.coinIcon} />
                </LinearGradient>
              </Animated.View>
              {rank === 1 && (
                <Animated.Text style={[styles.sparkle, sparkleStyle]} pointerEvents="none">
                  ✦
                </Animated.Text>
              )}
            </View>
            <Text style={[styles.topRankText, { color: metal.accent, textShadowColor: metal.glow }]}>{rank}</Text>
          </View>

          {/* Avatar in a metal ring + name */}
          <View style={styles.userCol}>
            <LinearGradient colors={metal.coin} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
              <ExpoImage
                source={{ uri: hunter.avatarUrl || FALLBACK_AVATAR }}
                style={styles.top3Avatar}
                contentFit="cover"
                placeholder={{ blurhash: BLURHASH }}
                cachePolicy="disk"
              />
            </LinearGradient>
            <NameWithStreak name={hunter.displayName} streak={hunter.streak} nameStyle={styles.displayNameText} />
          </View>

          <View style={styles.levelCol}>
            <View style={[styles.levelPill, { backgroundColor: metal.levelBg, borderColor: metal.levelBorder }]}>
              <Text style={[styles.top3LevelText, { color: metal.accent }]}>Lv. {hunter.level}</Text>
            </View>
          </View>

          <View style={styles.xpCol}>
            <Text style={[styles.lightningIcon, { color: metal.accent }]}>⚡</Text>
            <Text style={styles.xpScoreText}>{formatScore(hunter.score)}</Text>
          </View>

          {onPress ? (
            <View style={styles.chevronCol}>
              <Ionicons name="chevron-forward" size={16} color={metal.accent} />
            </View>
          ) : null}

          {/* Light sweep */}
          {cardWidth > 0 && (
            <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none">
              <LinearGradient
                colors={['rgba(255,255,255,0)', metal.shine, 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          )}
        </LinearGradient>
      </LinearGradient>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => onPress(hunter)} style={styles.cardWrapper}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.cardWrapper}>{content}</View>;
};

const LeaderboardHunterRowComponent: React.FC<LeaderboardHunterRowProps> = ({
  hunter,
  onPress,
}) => {
  const formatScore = (val: number) => {
    return val.toLocaleString('en-US');
  };

  const isTop3 = hunter.rank !== null && hunter.rank >= 1 && hunter.rank <= 3;
  const isCurrentUser = hunter.isCurrentUser;

  // 1. TOP 3 (gold, silver, bronze)
  if (isTop3) {
    return <Top3Card hunter={hunter} rank={hunter.rank as 1 | 2 | 3} onPress={onPress} formatScore={formatScore} />;
  }

  // 2. CURRENT USER HIGHLIGHTED CARD (Ranks 4+)
  if (isCurrentUser) {
    const CardContent = (
      <LinearGradient
        colors={['#2A1409', '#1C1E2A', '#141622', '#10121A']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.currentUserCard}
      >

        {/* Rank Number Column (#) */}
        <View style={styles.rankCol}>
          <Text style={styles.currentUserRankText}>{hunter.rank ?? "–"}</Text>
        </View>

        {/* User Column (Avatar + Display Name) */}
        <View style={styles.userCol}>
          <ExpoImage
            source={{ uri: hunter.avatarUrl || FALLBACK_AVATAR }}
            style={[styles.avatarImage, styles.currentUserAvatarBorder]}
            contentFit="cover"
            placeholder={{ blurhash: BLURHASH }}
            cachePolicy="disk"
          />
          <NameWithStreak name={hunter.displayName} streak={hunter.streak} nameStyle={styles.currentUserDisplayNameText} />
        </View>

        {/* Level Column */}
        <View style={styles.levelCol}>
          <View style={styles.currentUserLevelPill}>
            <Text style={styles.currentUserLevelText} numberOfLines={1}>
              Lv. {hunter.level}
            </Text>
          </View>
        </View>

        {/* XP Column */}
        <View style={styles.xpCol}>
          <Text style={[styles.lightningIcon, { color: '#FE5B01' }]}>⚡</Text>
          <Text style={styles.currentUserScoreText}>{formatScore(hunter.score)}</Text>
        </View>

        {/* Chevron Column — only shown when the row is actually tappable */}
        {onPress ? (
          <View style={styles.chevronCol}>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </View>
        ) : null}
      </LinearGradient>
    );

    if (onPress) {
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onPress(hunter)}
          style={styles.cardWrapper}
        >
          {CardContent}
        </TouchableOpacity>
      );
    }

    return <View style={styles.cardWrapper}>{CardContent}</View>;
  }

  // 3. REGULAR & HIGHLIGHTED HUNTER ROWS (Ranks 4 - 10+)
  const isHighlighted = Boolean(isCurrentUser);

  const RowContent = (
    <View
      style={[
        styles.regularRowContainer,
        isHighlighted && styles.highlightedRowContainer,
      ]}
    >
      {/* Rank Number Column (#) */}
      <View style={styles.rankCol}>
        <Text
          style={[
            styles.regularRankText,
            isHighlighted && styles.highlightedRankText,
          ]}
        >
          {hunter.rank ?? "–"}
        </Text>
      </View>

      {/* User Column (Avatar + Display Name) */}
      <View style={styles.userCol}>
        <ExpoImage
          source={{ uri: hunter.avatarUrl || FALLBACK_AVATAR }}
          style={[
            styles.avatarImage,
            isHighlighted && styles.highlightedAvatarBorder,
          ]}
          contentFit="cover"
          placeholder={{ blurhash: BLURHASH }}
          cachePolicy="disk"
        />
        <NameWithStreak name={hunter.displayName} streak={hunter.streak} nameStyle={styles.displayNameText} />
      </View>

      {/* Level Column (Level Pill) */}
      <View style={styles.levelCol}>
        <View
          style={[
            styles.levelPill,
            isHighlighted && styles.highlightedLevelPill,
          ]}
        >
          <Text
            style={[
              styles.levelText,
              isHighlighted && styles.highlightedLevelText,
            ]}
          >
            Lv. {hunter.level}
          </Text>
        </View>
      </View>

      {/* XP Column (Lightning + Numeric XP Score) */}
      <View style={styles.xpCol}>
        <Text style={styles.lightningIcon}>⚡</Text>
        <Text style={styles.xpScoreText}>{formatScore(hunter.score)}</Text>
      </View>

      {/* Chevron Column — only shown when the row is actually tappable */}
      {onPress ? (
        <View style={styles.chevronCol}>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={isHighlighted ? '#FE5B01' : '#71717A'}
          />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress(hunter)}
      >
        {RowContent}
      </TouchableOpacity>
    );
  }

  return RowContent;
};

// Fixed row height (see REGULAR_ROW_HEIGHT) lets the FlatList in
// leaderboard.tsx use getItemLayout for smooth scroll/jump-to-offset —
// this component is only ever virtualized for rank > 3, so this is the
// one height every virtualized row actually renders at.
export const REGULAR_ROW_HEIGHT = 70;

export const LeaderboardHunterRow = React.memo(LeaderboardHunterRowComponent);

const styles = StyleSheet.create({
  /* CARD WRAPPER (TOP 3 & CURRENT USER) */
  cardWrapper: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  top3Shadow: {
    borderRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
  },
  top3Frame: {
    borderRadius: 18,
    padding: 1.6,
  },
  top3Card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 11,
    borderRadius: 16.5,
    overflow: 'hidden',
    position: 'relative',
  },
  coinWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  coinGlow: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  coin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  sparkle: {
    position: 'absolute',
    top: -6,
    right: -6,
    fontSize: 10,
    color: '#FFF6CC',
  },
  avatarRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  top3Avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16161A',
  },
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: 0,
    width: SHINE_WIDTH,
  },
  currentUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FE5B01',
    backgroundColor: '#161822',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
  },

  /* REGULAR ROW CONTAINER & HIGHLIGHTED STATE */
  regularRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#0E0E12',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  highlightedRowContainer: {
    backgroundColor: '#161822',
    borderColor: '#FE5B01',
    borderWidth: 1.5,
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },

  /* RANK COLUMN (#) */
  rankCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  topRankText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '900',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  regularRankText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  highlightedRankText: {
    color: '#FE5B01',
    fontWeight: '900',
  },
  currentUserRankText: {
    fontFamily: fontFamilies.boldItalic,
    fontSize: 19,
    fontWeight: '900',
    color: '#F59E0B',
    fontStyle: 'italic',
    textShadowColor: 'rgba(245, 158, 11, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  /* USER COLUMN (AVATAR + NAME) */
  userCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  hunterInfoCol: {
    width: 98,
    justifyContent: 'center',
  },
  avatarCol: {
    width: 44,
    height: 44,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    borderColor: '#242428',
    backgroundColor: '#16161A',
    marginRight: 10,
  },
  highlightedAvatarBorder: {
    borderColor: '#FE5B01',
    borderWidth: 1.5,
  },
  currentUserAvatarBorder: {
    borderColor: '#F59E0B',
    borderWidth: 1.8,
  },
  nameBlock: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  streakText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '700',
    color: '#D4D4D8',
    letterSpacing: 0.2,
  },
  streakTextNone: {
    color: '#52525B',
  },
  displayNameText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  currentUserDisplayNameText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  /* LEVEL COLUMN */
  levelCol: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  levelPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightedLevelPill: {
    backgroundColor: 'rgba(254, 91, 1, 0.2)',
    borderColor: 'rgba(254, 91, 1, 0.4)',
  },
  currentUserLevelPill: {
    backgroundColor: 'rgba(25, 12, 5, 0.75)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(254, 91, 1, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  highlightedLevelText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  top3LevelText: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  currentUserLevelText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11.5,
    color: '#E4E4E7',
    fontWeight: '600',
  },

  /* XP COLUMN */
  xpCol: {
    width: 95,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginRight: 6,
  },
  lightningIcon: {
    fontSize: 13,
    color: '#F59E0B',
  },
  xpScoreText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fireIcon: {
    fontSize: 11,
  },
  scoreText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#E4E4E7',
    letterSpacing: 0.2,
  },
  top3ScoreText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  currentUserScoreText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  /* QUOTE COLUMN */
  quoteCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  quoteText: {
    fontFamily: fontFamilies.bold,
    fontSize: 8,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.5,
    lineHeight: 11,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  currentUserQuoteText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    fontWeight: '800',
    color: '#FE5B01',
    letterSpacing: 0.7,
    lineHeight: 12,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  /* CHEVRON COLUMN */
  chevronCol: {
    width: 18,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});


