import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
}

interface LeaderboardHunterRowProps {
  hunter: LeaderboardHunter;
  onPress?: (hunter: LeaderboardHunter) => void;
}

const LeaderboardHunterRowComponent: React.FC<LeaderboardHunterRowProps> = ({
  hunter,
  onPress,
}) => {
  const formatScore = (val: number) => {
    return val.toLocaleString('en-US');
  };

  const isTop3 = hunter.rank !== null && hunter.rank >= 1 && hunter.rank <= 3;
  const isCurrentUser = hunter.isCurrentUser;

  // Themes for Top 3 Cards
  const getRankTheme = () => {
    if (hunter.rank === 1) {
      return {
        accent: '#FFD700',
        border: 'rgba(255, 215, 0, 0.85)',
        shadow: '#FFD700',
        gradient: ['rgba(255, 215, 0, 0.38)', 'rgba(160, 110, 0, 0.22)', '#0E0B04', '#080602'] as const,
        glowGradient: ['rgba(255, 215, 0, 0.35)', 'rgba(255, 215, 0, 0.08)', 'transparent'] as const,
        levelBg: 'rgba(255, 215, 0, 0.08)',
        levelBorder: 'rgba(255, 215, 0, 0.30)',
        quoteColor: '#FFD700',
        chevronColor: '#FFD700',
      };
    }
    if (hunter.rank === 2) {
      return {
        accent: '#E2E8F0',
        border: 'rgba(226, 232, 240, 0.70)',
        shadow: '#94A3B8',
        gradient: ['rgba(148, 163, 184, 0.35)', 'rgba(51, 65, 85, 0.20)', '#07090D', '#040508'] as const,
        glowGradient: ['rgba(226, 232, 240, 0.35)', 'rgba(226, 232, 240, 0.08)', 'transparent'] as const,
        levelBg: 'rgba(255, 255, 255, 0.04)',
        levelBorder: 'rgba(226, 232, 240, 0.30)',
        quoteColor: '#CBD5E1',
        chevronColor: '#CBD5E1',
      };
    }
    if (hunter.rank === 3) {
      return {
        accent: '#CD7F32',
        border: 'rgba(205, 127, 50, 0.75)',
        shadow: '#CD7F32',
        gradient: ['rgba(205, 127, 50, 0.38)', 'rgba(95, 50, 15, 0.22)', '#090503', '#060302'] as const,
        glowGradient: ['rgba(205, 127, 50, 0.35)', 'rgba(205, 127, 50, 0.08)', 'transparent'] as const,
        levelBg: 'rgba(255, 255, 255, 0.04)',
        levelBorder: 'rgba(205, 127, 50, 0.30)',
        quoteColor: '#CD7F32',
        chevronColor: '#CD7F32',
      };
    }
    return {
      accent: '#A1A1AA',
      border: 'rgba(255, 255, 255, 0.06)',
      shadow: 'transparent',
      gradient: ['#141418', '#101014', '#0B0B0E', 'transparent'] as const,
      glowGradient: ['transparent', 'transparent', 'transparent'] as const,
      levelBg: '#16161A',
      levelBorder: '#242428',
      quoteColor: '#71717A',
      chevronColor: '#71717A',
    };
  };

  const rankTheme = getRankTheme();

  // 1. TOP 3 FEATURED CARDS (Ranks 1, 2, 3) - ALWAYS styled in Gold, Silver, Bronze
  if (isTop3) {
    const Top3Content = (
      <LinearGradient
        colors={rankTheme.gradient}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          styles.top3Card,
          {
            borderColor: rankTheme.border,
            shadowColor: rankTheme.shadow,
          },
        ]}
      >
        {/* Left Atmospheric Ambient Glow Overlay */}
        <LinearGradient
          colors={rankTheme.glowGradient}
          start={{ x: 0, y: 0.1 }}
          end={{ x: 0.6, y: 0.9 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Icon + Rank Number Column */}
        <View style={styles.rankCol}>
          {hunter.rank === 1 ? (
            <FontAwesome5 name="crown" size={15} color={rankTheme.accent} />
          ) : hunter.rank === 2 ? (
            <FontAwesome5 name="medal" size={15} color={rankTheme.accent} />
          ) : (
            <FontAwesome5 name="award" size={15} color={rankTheme.accent} />
          )}
          <Text style={[styles.topRankText, { color: rankTheme.accent }]}>
            {hunter.rank ?? "–"}
          </Text>
        </View>

        {/* User Column (Avatar + Display Name) */}
        <View style={styles.userCol}>
          <ExpoImage
            source={{ uri: hunter.avatarUrl || FALLBACK_AVATAR }}
            style={[
              styles.avatarImage,
              { borderColor: rankTheme.accent, borderWidth: 1.8 },
            ]}
            contentFit="cover"
            placeholder={{ blurhash: BLURHASH }}
            cachePolicy="disk"
          />
          <Text style={styles.displayNameText} numberOfLines={1}>
            {hunter.displayName}
          </Text>
        </View>

        {/* Level Column */}
        <View style={styles.levelCol}>
          <View style={[styles.levelPill, { backgroundColor: rankTheme.levelBg, borderColor: rankTheme.levelBorder }]}>
            <Text style={styles.top3LevelText}>Lv. {hunter.level}</Text>
          </View>
        </View>

        {/* XP Column */}
        <View style={styles.xpCol}>
          <Text style={[styles.lightningIcon, { color: rankTheme.accent }]}>⚡</Text>
          <Text style={styles.xpScoreText}>{formatScore(hunter.score)}</Text>
        </View>

        {/* Chevron Column — only shown when the row is actually tappable */}
        {onPress ? (
          <View style={styles.chevronCol}>
            <Ionicons name="chevron-forward" size={16} color={rankTheme.chevronColor} />
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
          {Top3Content}
        </TouchableOpacity>
      );
    }

    return <View style={styles.cardWrapper}>{Top3Content}</View>;
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
          <Text style={styles.currentUserDisplayNameText} numberOfLines={1}>
            {hunter.displayName}
          </Text>
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
        <Text style={styles.displayNameText} numberOfLines={1}>
          {hunter.displayName}
        </Text>
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
  top3Card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
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
    fontSize: 13.5,
    fontWeight: '900',
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
    marginBottom: 2,
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


