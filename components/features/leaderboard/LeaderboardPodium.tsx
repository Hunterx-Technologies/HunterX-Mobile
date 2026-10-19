import React from 'react';
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { fontFamilies } from '@/theme/typography';
import { OFFICIAL_HUNTER_AVATARS } from '@/services/api/avatar.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Local fallback or bundled image
let PODIUM_BG_IMAGE: any = null;
try {
  PODIUM_BG_IMAGE = require('@/assets/images/podium_stage_bg.jpg');
} catch (e) {
  PODIUM_BG_IMAGE = null;
}

export interface PodiumHunter {
  id: string;
  rank: 1 | 2 | 3;
  displayName: string;
  score: number;
  level: number;
  avatarUrl?: string | ImageSourcePropType;
  quote?: string;
}

interface LeaderboardPodiumProps {
  topHunters: PodiumHunter[];
  onSelectHunter?: (hunter: PodiumHunter) => void;
}

/* ==========================================================================
   5-POINT ROYAL CROWN WITH SPHERES & METALLIC SHADING
   ========================================================================== */
const Royal5PointCrown: React.FC<{ rank: 1 | 2 | 3 }> = ({ rank }) => {
  const isGold = rank === 1;
  const isSilver = rank === 2;

  const gradId = `royal-crown-grad-${rank}`;
  const c1 = isGold ? '#FFFBEB' : isSilver ? '#FFFFFF' : '#FFF7ED';
  const c2 = isGold ? '#FBBF24' : isSilver ? '#E2E8F0' : '#FB923C';
  const c3 = isGold ? '#D97706' : isSilver ? '#94A3B8' : '#C2410C';
  const stroke = isGold ? '#FEF08A' : isSilver ? '#FFFFFF' : '#FED7AA';
  const textColor = isGold ? '#451A03' : isSilver ? '#0F172A' : '#431407';

  const width = isGold ? 50 : 40;
  const height = isGold ? 36 : 30;

  return (
    <View style={styles.crownOuter}>
      <Svg width={width} height={height} viewBox="0 0 54 42" fill="none">
        <Defs>
          <SvgLinearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={c1} />
            <Stop offset="40%" stopColor={c2} />
            <Stop offset="100%" stopColor={c3} />
          </SvgLinearGradient>
        </Defs>

        {/* 5-Spike Royal Crown Body */}
        <Path
          d="M6 34 L8 16 L18 23 L27 8 L36 23 L46 16 L48 34 Z"
          fill={`url(#${gradId})`}
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Base Rim Bar */}
        <Path
          d="M5 34 H49 V39 C49 40 48 41 47 41 H7 C6 41 5 40 5 39 Z"
          fill={`url(#${gradId})`}
          stroke={stroke}
          strokeWidth="1.4"
        />

        {/* 5 Spheres on spike tips */}
        <Circle cx="8" cy="16" r="3.4" fill={c1} stroke={stroke} strokeWidth="1.2" />
        <Circle cx="18" cy="23" r="3" fill={c1} stroke={stroke} strokeWidth="1.2" />
        <Circle cx="27" cy="8" r="4.2" fill={c1} stroke={stroke} strokeWidth="1.4" />
        <Circle cx="36" cy="23" r="3" fill={c1} stroke={stroke} strokeWidth="1.2" />
        <Circle cx="46" cy="16" r="3.4" fill={c1} stroke={stroke} strokeWidth="1.2" />
      </Svg>

      {/* Rank Number centered on the Crown */}
      <View style={styles.crownNumberWrapper}>
        <Text style={[styles.crownNumberText, { color: textColor }]}>{rank}</Text>
      </View>
    </View>
  );
};

export const LeaderboardPodium: React.FC<LeaderboardPodiumProps> = ({
  topHunters,
  onSelectHunter,
}) => {
  const rank1 = topHunters.find((h) => h.rank === 1);
  const rank2 = topHunters.find((h) => h.rank === 2);
  const rank3 = topHunters.find((h) => h.rank === 3);

  const renderAvatarSource = (source?: string | ImageSourcePropType) => {
    if (!source) {
      return { uri: OFFICIAL_HUNTER_AVATARS[0].image_url };
    }
    if (typeof source === 'string') {
      return { uri: source };
    }
    return source;
  };

  return (
    <View style={styles.podiumContainer}>
      {/* 1. EXACT 3D VOLCANIC STONE PODIUM BACKGROUND IMAGE */}
      {PODIUM_BG_IMAGE && (
        <Image
          source={PODIUM_BG_IMAGE}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      )}

      {/* 2. Deep Dark Top and Bottom Gradient Fade (Reduces orange glow, blends cleanly into dark canvas) */}
      <LinearGradient
        colors={['rgba(9, 9, 11, 0.5)', 'rgba(9, 9, 11, 0.25)', 'rgba(9, 9, 11, 0.85)', '#09090B']}
        locations={[0, 0.35, 0.8, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* 3. STATIC 3-PODIUM HUNTER SLOTS */}
      <View style={styles.podiumRow}>
        {/* =================================================================
            RANK 2: ZENITH (LEFT - SLATE ROCK PEDESTAL)
            ================================================================= */}
        {rank2 && (
          <TouchableOpacity
            style={[styles.podiumSlot, styles.slot2]}
            activeOpacity={0.88}
            onPress={() => onSelectHunter?.(rank2)}
          >
            {/* 5-Point Silver Crown */}
            <Royal5PointCrown rank={2} />

            {/* Avatar in Silver/Cyan Glowing Ring */}
            <View style={[styles.avatarRing, styles.avatarRingSilver]}>
              <Image
                source={renderAvatarSource(rank2.avatarUrl)}
                style={styles.avatarImg}
              />
            </View>

            {/* Hunter Info on Left Pedestal */}
            <View style={styles.pillarContent}>
              <Text style={styles.hunterName} numberOfLines={1}>
                {rank2.displayName}
              </Text>

              <View style={styles.xpRow}>
                <Ionicons name="flame" size={15} color="#F97316" style={styles.flameIcon} />
                <Text style={styles.xpText}>{rank2.score.toLocaleString()} XP</Text>
              </View>

              <View style={styles.levelBadgeSilver}>
                <Text style={styles.levelTextSilver}>Lv. {rank2.level}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* =================================================================
            RANK 1: SHADOWRISE (CENTER - GOLDEN MONARCH PEAK)
            ================================================================= */}
        {rank1 && (
          <TouchableOpacity
            style={[styles.podiumSlot, styles.slot1]}
            activeOpacity={0.88}
            onPress={() => onSelectHunter?.(rank1)}
          >
            {/* 5-Point Golden Crown */}
            <Royal5PointCrown rank={1} />

            {/* Avatar in Radiant Gold Glowing Ring */}
            <View style={[styles.avatarRing, styles.avatarRingGold]}>
              <Image
                source={renderAvatarSource(rank1.avatarUrl)}
                style={styles.avatarImgGold}
              />
            </View>

            {/* Hunter Info on Center Pedestal */}
            <View style={styles.pillarContent}>
              <Text style={[styles.hunterName, styles.hunterNameGold]} numberOfLines={1}>
                {rank1.displayName}
              </Text>

              <View style={styles.xpRow}>
                <Ionicons name="flame" size={16} color="#F97316" style={styles.flameIcon} />
                <Text style={[styles.xpText, styles.xpTextGold]}>
                  {rank1.score.toLocaleString()} XP
                </Text>
              </View>

              <View style={styles.levelBadgeGold}>
                <Text style={styles.levelTextGold}>Lv. {rank1.level}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* =================================================================
            RANK 3: NOVA (RIGHT - COPPER / BRONZE PEDESTAL)
            ================================================================= */}
        {rank3 && (
          <TouchableOpacity
            style={[styles.podiumSlot, styles.slot3]}
            activeOpacity={0.88}
            onPress={() => onSelectHunter?.(rank3)}
          >
            {/* 5-Point Bronze Crown */}
            <Royal5PointCrown rank={3} />

            {/* Avatar in Bronze Glowing Ring */}
            <View style={[styles.avatarRing, styles.avatarRingBronze]}>
              <Image
                source={renderAvatarSource(rank3.avatarUrl)}
                style={styles.avatarImg}
              />
            </View>

            {/* Hunter Info on Right Pedestal */}
            <View style={styles.pillarContent}>
              <Text style={styles.hunterName} numberOfLines={1}>
                {rank3.displayName}
              </Text>

              <View style={styles.xpRow}>
                <Ionicons name="flame" size={15} color="#F97316" style={styles.flameIcon} />
                <Text style={styles.xpText}>{rank3.score.toLocaleString()} XP</Text>
              </View>

              <View style={styles.levelBadgeBronze}>
                <Text style={styles.levelTextBronze}>Lv. {rank3.level}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  podiumContainer: {
    width: '100%',
    minHeight: 275,
    paddingTop: 16,
    paddingBottom: 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 8,
    zIndex: 20,
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
    paddingBottom: 6,
  },
  slot1: {
    zIndex: 25,
    marginHorizontal: 3,
    marginBottom: 8,
  },
  slot2: {
    zIndex: 20,
    marginBottom: 0,
  },
  slot3: {
    zIndex: 20,
    marginBottom: 0,
  },

  /* Crown */
  crownOuter: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -8,
    zIndex: 30,
  },
  crownNumberWrapper: {
    position: 'absolute',
    bottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownNumberText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
    fontWeight: '900',
  },

  /* Avatar Rings */
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141418',
    marginBottom: 6,
    zIndex: 25,
  },
  avatarRingGold: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 8,
  },
  avatarRingSilver: {
    borderWidth: 2.2,
    borderColor: '#CBD5E1',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarRingBronze: {
    borderWidth: 2.2,
    borderColor: '#EA580C',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarImg: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  avatarImgGold: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },

  pillarContent: {
    alignItems: 'center',
    width: '100%',
    paddingTop: 2,
  },

  /* Text & Labels */
  hunterName: {
    fontFamily: fontFamilies.bold,
    fontSize: 14.5,
    color: '#FFFFFF',
    marginTop: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 5,
  },
  hunterNameGold: {
    fontSize: 16.5,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  flameIcon: {
    marginRight: 4,
  },
  xpText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 5,
  },
  xpTextGold: {
    fontSize: 13.5,
  },

  /* Level Capsule Badges (Clean, dark background with subtle borders) */
  levelBadgeSilver: {
    backgroundColor: '#16161B',
    borderWidth: 1,
    borderColor: '#2E2E36',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginTop: 6,
  },
  levelTextSilver: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#D4D4D8',
  },

  levelBadgeGold: {
    backgroundColor: '#1A181C',
    borderWidth: 1.2,
    borderColor: '#78350F',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 3.5,
    marginTop: 6,
  },
  levelTextGold: {
    fontFamily: fontFamilies.bold,
    fontSize: 11.5,
    color: '#FDE047',
  },

  levelBadgeBronze: {
    backgroundColor: '#16161B',
    borderWidth: 1,
    borderColor: '#431407',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginTop: 6,
  },
  levelTextBronze: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#FED7AA',
  },
});
