import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { fontFamilies } from '@/theme/typography';
import type { LeaderboardMe } from '@/types/leaderboard';

interface LeaderboardCommunityCardProps {
  me: LeaderboardMe | null;
  onPressRanked?: () => void;
  onPressSettings?: () => void;
}

function buildCardCopy(me: LeaderboardMe): { title: React.ReactNode; subtitle: string; isLink: boolean } {
  if (me.status === 'hidden') {
    return {
      title: <Text style={styles.titleWhite}>You're hidden from leaderboards</Text>,
      subtitle: 'Tap to manage visibility in System Settings',
      isLink: true,
    };
  }

  if (me.status === 'unranked_no_xp') {
    return {
      title: <Text style={styles.titleWhite}>Complete your first quest to join the leaderboard</Text>,
      subtitle: 'Finish a quest today and claim your first rank.',
      isLink: false,
    };
  }

  // status === 'ranked', top 3 — a badge + praise line instead of a
  // percentage, echoing the gold/silver/bronze styling the row itself
  // already uses for these exact ranks.
  if (me.rank === 1) {
    return {
      title: (
        <>
          <Text style={styles.titleWhite}>You </Text>
          <Text style={styles.titleDot}>• </Text>
          <Text style={styles.titleOrange}>Apex Hunter 👑</Text>
        </>
      ),
      subtitle: 'Unrivaled. No one stands above you.',
      isLink: false,
    };
  }

  if (me.rank === 2) {
    return {
      title: (
        <>
          <Text style={styles.titleWhite}>You </Text>
          <Text style={styles.titleDot}>• </Text>
          <Text style={styles.titleOrange}>Silver Hunter</Text>
        </>
      ),
      subtitle: 'One step from the Apex — keep climbing.',
      isLink: false,
    };
  }

  if (me.rank === 3) {
    return {
      title: (
        <>
          <Text style={styles.titleWhite}>You </Text>
          <Text style={styles.titleDot}>• </Text>
          <Text style={styles.titleOrange}>Bronze Hunter</Text>
        </>
      ),
      subtitle: 'Among the Elite Three. The hunt continues.',
      isLink: false,
    };
  }

  // status === 'ranked', rank 4+
  if (me.topPercent != null) {
    return {
      title: (
        <>
          <Text style={styles.titleWhite}>You </Text>
          <Text style={styles.titleDot}>• </Text>
          <Text style={styles.titleOrange}>Top {me.topPercent}%</Text>
        </>
      ),
      subtitle: 'See how you compare and what keeps you ahead.',
      isLink: false,
    };
  }

  if (me.rank != null) {
    return {
      title: (
        <>
          <Text style={styles.titleWhite}>You </Text>
          <Text style={styles.titleDot}>• </Text>
          <Text style={styles.titleOrange}>
            Rank #{me.rank}{me.totalRanked != null ? ` of ${me.totalRanked}` : ''}
          </Text>
        </>
      ),
      subtitle: 'See how you compare and what keeps you ahead.',
      isLink: false,
    };
  }

  // Redis fallback mode — no rank available at all, only total XP.
  return {
    title: (
      <>
        <Text style={styles.titleWhite}>You </Text>
        <Text style={styles.titleDot}>• </Text>
        <Text style={styles.titleOrange}>{me.totalXp.toLocaleString('en-US')} XP</Text>
      </>
    ),
    subtitle: 'Rankings are catching up — your XP is safe.',
    isLink: false,
  };
}

export const LeaderboardCommunityCard: React.FC<LeaderboardCommunityCardProps> = ({
  me,
  onPressRanked,
  onPressSettings,
}) => {
  if (!me) return null;

  const { title, subtitle, isLink } = buildCardCopy(me);
  const onPress = me.status === 'hidden' ? onPressSettings : me.status === 'ranked' ? onPressRanked : undefined;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={!onPress}
      onPress={onPress}
      style={styles.container}
    >
      <LinearGradient
        colors={['#0A0503', '#1F0C05', '#3E1906']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Inner Subtle Glow Overlay (Orange @ ~25% opacity) */}
        <LinearGradient
          colors={['rgba(254, 91, 1, 0.25)', 'transparent', 'rgba(254, 91, 1, 0.25)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Left Glowing Crest Emblem Badge */}
        <View style={styles.emblemWrapper}>
          <Svg width={54} height={54} viewBox="0 0 54 54" fill="none">
            {/* Circle Glow Backing (Orange @ 30% opacity) */}
            <Circle cx={27} cy={27} r={24} fill="rgba(254, 91, 1, 0.30)" />

            {/* Subtle Diamond/Notch Geometric Accent Lines */}
            <Path
              d="M27 3 L51 27 L27 51 L3 27 Z"
              stroke="rgba(254, 91, 1, 0.35)"
              strokeWidth={1}
            />

            {/* Trophy Circle Border */}
            <Circle
              cx={27}
              cy={27}
              r={23}
              stroke="#FE5B01"
              strokeWidth={1.6}
            />

            {/* Bottom Notch Point */}
            <Path
              d="M25 50 L27 52.5 L29 50"
              stroke="#FE5B01"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Gold Trophy Cup (#F0A459) */}
            <Path
              d="M21 11 H33 V18 C33 21.2 30.3 23.8 27 23.8 C23.7 23.8 21 21.2 21 18 V11 Z"
              fill="#F0A459"
            />
            {/* Trophy Inner Diamond */}
            <Path
              d="M27 15 L29 17.5 L27 20 L25 17.5 Z"
              fill="#FE5B01"
            />
            {/* Trophy Left Handle (#F0A459) */}
            <Path
              d="M21 12.5 H18 C16.8 12.5 16 13.3 16 14.5 V15.5 C16 17 17.2 18.2 18.8 18.2 H21"
              stroke="#F0A459"
              strokeWidth={1.3}
              strokeLinecap="round"
            />
            {/* Trophy Right Handle (#F0A459) */}
            <Path
              d="M33 12.5 H36 C37.2 12.5 38 13.3 38 14.5 V15.5 C38 17 36.8 18.2 35.2 18.2 H33"
              stroke="#F0A459"
              strokeWidth={1.3}
              strokeLinecap="round"
            />
            {/* Trophy Stem & Pedestal (#F0A459) */}
            <Path d="M25 23.8 V26.5 H29 V23.8" stroke="#F0A459" strokeWidth={1.3} />
            <Path d="M22 26.5 H32" stroke="#F0A459" strokeWidth={1.6} strokeLinecap="round" />

            {/* 3 Orange Growth Bars (Left, Center, Right) */}
            <Rect x={19.5} y={34} width={4.2} height={8.5} rx={1.2} fill="#FE5B01" />
            <Rect x={24.9} y={29.5} width={4.2} height={13} rx={1.2} fill="#FE5B01" />
            <Rect x={30.3} y={33} width={4.2} height={9.5} rx={1.2} fill="#FE5B01" />
          </Svg>
        </View>

        {/* Center Text Info */}
        <View style={styles.textCol}>
          <View style={styles.titleRow}>{title}</View>
          <Text style={styles.subtitleText}>{subtitle}</Text>
        </View>

        {isLink ? (
          <View style={styles.chevronCol}>
            <Ionicons name="chevron-forward" size={18} color="#FE5B01" />
          </View>
        ) : null}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  cardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FE5B01',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.40,
    shadowRadius: 15,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0A0503',
  },
  emblemWrapper: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textCol: {
    flex: 1,
    paddingRight: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  titleWhite: {
    fontFamily: fontFamilies.bold,
    fontSize: 16.5,
    fontWeight: '800',
    color: '#F0F0F0',
    letterSpacing: 0.2,
  },
  titleDot: {
    fontFamily: fontFamilies.bold,
    fontSize: 16.5,
    fontWeight: '800',
    color: '#F0F0F0',
  },
  titleOrange: {
    fontFamily: fontFamilies.bold,
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FE5B01',
    letterSpacing: 0.2,
  },
  subtitleText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12.5,
    color: '#B8B5B7',
    lineHeight: 17.5,
  },
  chevronCol: {
    width: 22,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});


