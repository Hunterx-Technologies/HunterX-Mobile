import React from 'react';
import {
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { fontFamilies } from '@/theme/typography';
import { getAvatarSource } from '@/components/profile/AvatarSelectionModal';
import { OFFICIAL_HUNTER_AVATARS } from '@/services/api/avatar.service';

const LOCAL_FALLBACK_AVATAR = require('@/assets/images/jinwoo.jpg');
const DEFAULT_AVATAR = { uri: OFFICIAL_HUNTER_AVATARS[0].image_url };

export interface LeaderboardHunter {
  id: string;
  rank: number;
  displayName: string;
  score: number;
  level: number;
  avatarUrl?: string | ImageSourcePropType;
  quote?: string;
  tagline?: string;
  title?: string;
  streakDays?: number;
  daysActive?: number;
  isCurrentUser?: boolean;
}

interface LeaderboardHunterRowProps {
  hunter: LeaderboardHunter;
  onPress?: (hunter: LeaderboardHunter) => void;
}

export const LeaderboardHunterRow: React.FC<LeaderboardHunterRowProps> = ({
  hunter,
  onPress,
}) => {
  const isCurrent = !!hunter.isCurrentUser;

  const renderAvatarSource = (source?: string | ImageSourcePropType) => {
    if (!source || source === '') {
      return DEFAULT_AVATAR;
    }
    if (typeof source === 'string') {
      if (source.startsWith('http://') || source.startsWith('https://')) {
        return { uri: source };
      }
      return getAvatarSource(source);
    }
    return source;
  };

  /* -------------------------------------------------------------
   * 1. CURRENT USER HIGHLIGHTED ROW (Rank 12)
   * ----------------------------------------------------------- */
  if (isCurrent) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPress?.(hunter)}
        style={styles.cardContainer}
      >
        <LinearGradient
          colors={['#24090C', '#170608', '#0E0405']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.currentUserCard}
        >
          {/* Rank Number in Vibrant Red */}
          <View style={styles.rankCol}>
            <Text style={styles.currentUserRankNum}>{hunter.rank}</Text>
          </View>

          {/* Avatar with Red Border Ring */}
          <View style={styles.currentUserAvatarRing}>
            <ExpoImage
              source={renderAvatarSource(hunter.avatarUrl)}
              style={styles.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="high"
              transition={150}
              placeholder={LOCAL_FALLBACK_AVATAR}
            />
          </View>

          {/* Details (Name + Flame Score) */}
          <View style={styles.detailsCol}>
            <Text style={styles.currentUserName} numberOfLines={1}>
              {hunter.displayName}
            </Text>
            <View style={styles.scoreRow}>
              <Ionicons name="flame" size={13} color="#EF4444" style={styles.flameIcon} />
              <Text style={styles.currentUserScoreText}>
                {hunter.score.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Level Pill */}
          <View style={styles.currentUserLevelBadge}>
            <Text style={styles.currentUserLevelText}>Lv. {hunter.level}</Text>
          </View>

          {/* Chevron */}
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#EF4444"
            style={styles.chevron}
          />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  /* -------------------------------------------------------------
   * 2. RANK 1: GOLD GLOW CARD
   * ----------------------------------------------------------- */
  if (hunter.rank === 1) {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onPress?.(hunter)}
        style={styles.cardContainer}
      >
        <LinearGradient
          colors={['#17130A', '#100E07', '#0A0905']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.goldCard}
        >
          {/* Rank Col: Gold Crown + "1" */}
          <View style={styles.rankCol}>
            <FontAwesome5 name="crown" size={12} color="#F59E0B" style={styles.crownIcon} />
            <Text style={styles.goldRankNum}>1</Text>
          </View>

          {/* Avatar with Gold Ring */}
          <View style={styles.goldAvatarRing}>
            <ExpoImage
              source={renderAvatarSource(hunter.avatarUrl)}
              style={styles.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="high"
              transition={150}
              placeholder={LOCAL_FALLBACK_AVATAR}
            />
          </View>

          {/* Details */}
          <View style={styles.detailsCol}>
            <Text style={styles.hunterName} numberOfLines={1}>
              {hunter.displayName}
            </Text>
            <View style={styles.scoreRow}>
              <Ionicons name="flame" size={13} color="#EF4444" style={styles.flameIcon} />
              <Text style={styles.scoreText}>
                {hunter.score.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Level Pill */}
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lv. {hunter.level}</Text>
          </View>

          {/* Chevron */}
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#A1A1AA"
            style={styles.chevron}
          />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  /* -------------------------------------------------------------
   * 3. RANK 2: SILVER GLOW CARD
   * ----------------------------------------------------------- */
  if (hunter.rank === 2) {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onPress?.(hunter)}
        style={styles.cardContainer}
      >
        <LinearGradient
          colors={['#111317', '#0B0D10', '#07080B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.silverCard}
        >
          {/* Rank Col: Silver Crown + "2" */}
          <View style={styles.rankCol}>
            <FontAwesome5 name="crown" size={12} color="#CBD5E1" style={styles.crownIcon} />
            <Text style={styles.silverRankNum}>2</Text>
          </View>

          {/* Avatar with Silver Ring */}
          <View style={styles.silverAvatarRing}>
            <ExpoImage
              source={renderAvatarSource(hunter.avatarUrl)}
              style={styles.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="high"
              transition={150}
              placeholder={LOCAL_FALLBACK_AVATAR}
            />
          </View>

          {/* Details */}
          <View style={styles.detailsCol}>
            <Text style={styles.hunterName} numberOfLines={1}>
              {hunter.displayName}
            </Text>
            <View style={styles.scoreRow}>
              <Ionicons name="flame" size={13} color="#EF4444" style={styles.flameIcon} />
              <Text style={styles.scoreText}>
                {hunter.score.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Level Pill */}
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lv. {hunter.level}</Text>
          </View>

          {/* Chevron */}
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#A1A1AA"
            style={styles.chevron}
          />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  /* -------------------------------------------------------------
   * 4. RANK 3: BRONZE GLOW CARD
   * ----------------------------------------------------------- */
  if (hunter.rank === 3) {
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onPress?.(hunter)}
        style={styles.cardContainer}
      >
        <LinearGradient
          colors={['#16110A', '#100B07', '#0A0704']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bronzeCard}
        >
          {/* Rank Col: Bronze Crown + "3" */}
          <View style={styles.rankCol}>
            <FontAwesome5 name="crown" size={12} color="#D97706" style={styles.crownIcon} />
            <Text style={styles.bronzeRankNum}>3</Text>
          </View>

          {/* Avatar with Bronze Ring */}
          <View style={styles.bronzeAvatarRing}>
            <ExpoImage
              source={renderAvatarSource(hunter.avatarUrl)}
              style={styles.avatarImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="high"
              transition={150}
              placeholder={LOCAL_FALLBACK_AVATAR}
            />
          </View>

          {/* Details */}
          <View style={styles.detailsCol}>
            <Text style={styles.hunterName} numberOfLines={1}>
              {hunter.displayName}
            </Text>
            <View style={styles.scoreRow}>
              <Ionicons name="flame" size={13} color="#EF4444" style={styles.flameIcon} />
              <Text style={styles.scoreText}>
                {hunter.score.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Level Pill */}
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lv. {hunter.level}</Text>
          </View>

          {/* Chevron */}
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#A1A1AA"
            style={styles.chevron}
          />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  /* -------------------------------------------------------------
   * 5. STANDARD CARDS (Ranks 4+)
   * ----------------------------------------------------------- */
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={() => onPress?.(hunter)}
      style={styles.cardContainer}
    >
      <View style={styles.standardCard}>
        {/* Rank Number */}
        <View style={styles.rankCol}>
          <Text style={styles.standardRankNum}>{hunter.rank}</Text>
        </View>

        {/* Avatar */}
        <View style={styles.standardAvatarRing}>
          <ExpoImage
            source={renderAvatarSource(hunter.avatarUrl)}
            style={styles.avatarImg}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={150}
            placeholder={LOCAL_FALLBACK_AVATAR}
          />
        </View>

        {/* Details */}
        <View style={styles.detailsCol}>
          <Text style={styles.hunterName} numberOfLines={1}>
            {hunter.displayName}
          </Text>
          <View style={styles.scoreRow}>
            <Ionicons name="flame" size={13} color="#EF4444" style={styles.flameIcon} />
            <Text style={styles.scoreText}>
              {hunter.score.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Level Pill */}
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Lv. {hunter.level}</Text>
        </View>

        {/* Chevron */}
        <Ionicons
          name="chevron-forward"
          size={16}
          color="#52525B"
          style={styles.chevron}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginVertical: 4,
  },

  /* Rank Col */
  rankCol: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  crownIcon: {
    marginBottom: 1,
  },
  goldRankNum: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#F59E0B',
  },
  silverRankNum: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#CBD5E1',
  },
  bronzeRankNum: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#D97706',
  },
  standardRankNum: {
    fontFamily: fontFamilies.bold,
    fontSize: 15.5,
    color: '#8E95A5',
  },
  currentUserRankNum: {
    fontFamily: fontFamilies.bold,
    fontSize: 17.5,
    color: '#EF4444',
  },

  /* Avatar Rings */
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  goldAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.6,
    borderColor: '#F59E0B',
    overflow: 'hidden',
    backgroundColor: '#18150C',
    marginRight: 10,
  },
  silverAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.6,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    backgroundColor: '#101317',
    marginRight: 10,
  },
  bronzeAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.6,
    borderColor: '#D97706',
    overflow: 'hidden',
    backgroundColor: '#16100B',
    marginRight: 10,
  },
  standardAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#262734',
    overflow: 'hidden',
    backgroundColor: '#14141A',
    marginRight: 10,
  },
  currentUserAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.6,
    borderColor: '#EF4444',
    overflow: 'hidden',
    backgroundColor: '#1F080B',
    marginRight: 10,
  },

  /* Details Col */
  detailsCol: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  hunterName: {
    fontFamily: fontFamilies.bold,
    fontSize: 14.5,
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  currentUserName: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flameIcon: {
    marginRight: 3,
  },
  scoreText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12.5,
    color: '#E4E4E7',
  },
  currentUserScoreText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },

  /* Level Badges */
  levelBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: '#272834',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 10,
  },
  levelText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#9CA3AF',
  },
  currentUserLevelBadge: {
    backgroundColor: '#200A0D',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 10,
  },
  currentUserLevelText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#F87171',
  },

  /* Chevron */
  chevron: {
    marginLeft: 2,
  },

  /* Card Containers */
  goldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 4,
  },
  silverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(203, 213, 225, 0.35)',
    shadowColor: '#CBD5E1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  bronzeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(217, 119, 6, 0.35)',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  standardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#0E0E13',
    borderWidth: 1,
    borderColor: '#1D1E28',
  },
  currentUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 9,
    elevation: 5,
  },
});
