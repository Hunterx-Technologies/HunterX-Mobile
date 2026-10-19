import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fontFamilies } from '@/theme/typography';
import { useAuth } from '@/hooks/useAuth';
import { getAvatarSource } from '@/components/profile/AvatarSelectionModal';
import { optimizeCloudinaryUrl } from '@/services/media/cloudinary';
import { OFFICIAL_HUNTER_AVATARS } from '@/services/api/avatar.service';

const TOP5_BG = require('@/assets/images/top5bg.jpg');
const LOCAL_FALLBACK_AVATAR = require('@/assets/images/jinwoo.jpg');
const OFFICIAL_FALLBACK_AVATAR = { uri: OFFICIAL_HUNTER_AVATARS[0].image_url };
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LeaderboardTop5ModalProps {
  visible: boolean;
  onClose: () => void;
  userRank?: number;
  totalXp?: number;
  userLevel?: number;
  percentile?: string;
}

export const LeaderboardTop5Modal: React.FC<LeaderboardTop5ModalProps> = ({
  visible,
  onClose,
  userRank: propRank,
  totalXp: propXp,
  userLevel: propLevel,
  percentile = 'Top 5%',
}) => {
  const { user } = useAuth();
  const userAny = user as any;
  const [imageError, setImageError] = useState(false);

  const progression = userAny?.user_progression || user?.user_progression || {};
  const totalXp = propXp ?? progression?.total_xp ?? user?.xp ?? 320;
  const userLevel = propLevel ?? progression?.current_level ?? user?.level ?? 3;
  const userRank = propRank ?? userAny?.rank ?? 3;
  const displayName = user?.displayName || user?.name || 'You';

  const avatarSource = useMemo(() => {
    if (imageError) return OFFICIAL_FALLBACK_AVATAR;
    const rawAvatar = user?.avatarUrl || (userAny?.avatar_id ? getAvatarSource(null, userAny.avatar_id)?.uri : null);
    if (!rawAvatar) return OFFICIAL_FALLBACK_AVATAR;

    if (typeof rawAvatar === 'string') {
      if (rawAvatar.startsWith('http://') || rawAvatar.startsWith('https://')) {
        return { uri: optimizeCloudinaryUrl(rawAvatar, 250) };
      }
      const resolved = getAvatarSource(rawAvatar);
      if (resolved && resolved.uri) {
        return { uri: optimizeCloudinaryUrl(resolved.uri, 250) };
      }
    }
    return OFFICIAL_FALLBACK_AVATAR;
  }, [user?.avatarUrl, userAny?.avatar_id, imageError]);

  useEffect(() => {
    if (avatarSource && typeof avatarSource === 'object' && 'uri' in avatarSource && avatarSource.uri) {
      ExpoImage.prefetch(avatarSource.uri);
    }
  }, [avatarSource]);

  const formatScore = (val: number) => {
    return val.toLocaleString('en-US');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🔥 I ranked #${userRank} (${percentile}) on HunterX with ${formatScore(
          totalXp
        )} XP! Discipline today, a stronger you tomorrow. Rise with me on HunterX!`,
      });
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.85)" />

        {/* Backdrop dismiss touchable */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* MAIN POPUP ACHIEVEMENT CARD */}
        <View style={styles.popupCardContainer}>
          {/* Background Artwork */}
          <Image
            source={TOP5_BG}
            style={styles.cardBgImage}
            resizeMode="cover"
          />

          {/* Vignette Gradient Overlays: Deep crimson fade from top moon to dark floor */}
          <LinearGradient
            colors={[
              'rgba(10, 4, 6, 0.65)',
              'rgba(14, 6, 9, 0.45)',
              'rgba(10, 4, 6, 0.85)',
              '#09090C',
              '#07070A',
            ]}
            locations={[0, 0.28, 0.6, 0.85, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* TOP HEADER: Brand on left, Clean Action Buttons on right */}
          <View style={styles.headerBar}>
            <View style={styles.brandContainer}>
              <Text style={styles.brandTitle}>
                <Text style={styles.brandTitleWhite}>HUNTER</Text>
                <Text style={styles.brandTitleRed}>X</Text>
              </Text>
              <Text style={styles.brandSubtitle}>ELITE RANKINGS</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleShare}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="share-2" size={19} color="#E4E4E7" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* PRESTIGE CROWN BADGE */}
            <View style={styles.prestigeBadgeWrapper}>
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.28)', 'rgba(239, 68, 68, 0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.prestigePill}
              >
                <FontAwesome5
                  name="crown"
                  size={13}
                  color="#EF4444"
                  style={styles.prestigeCrownIcon}
                />
                <Text style={styles.prestigeBadgeText}>TOP 5% HUNTER</Text>
              </LinearGradient>
              <Text style={styles.prestigeTagline}>AURA OF THE MONARCH</Text>
            </View>

            {/* HERO AVATAR SHOWCASE WITH GLOWING AURA */}
            <View style={styles.avatarShowcaseSection}>
              {/* Outer Radiant Glow Ring */}
              <View style={styles.avatarOuterPulseRing}>
                {/* Inner Glowing Border */}
                <View style={styles.avatarInnerGlowRing}>
                  <ExpoImage
                    source={avatarSource}
                    style={styles.avatarImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    priority="high"
                    transition={150}
                    placeholder={LOCAL_FALLBACK_AVATAR}
                    onError={() => setImageError(true)}
                  />
                </View>

                {/* Floating Rank Tag Badge (#3) */}
                <LinearGradient
                  colors={['#EF4444', '#B91C1C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.floatingRankBadge}
                >
                  <Text style={styles.floatingRankText}>#{userRank}</Text>
                </LinearGradient>
              </View>

              {/* Hunter Name & Title */}
              <Text style={styles.hunterDisplayName}>{displayName}</Text>
              <View style={styles.hunterStatusRow}>
                <MaterialCommunityIcons
                  name="shield-sword-outline"
                  size={14}
                  color="#EF4444"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.hunterStatusText}>Awakened S-Rank Contender</Text>
              </View>
            </View>

            {/* 3-PILLAR PERFORMANCE HUD BAR */}
            <View style={styles.statsHudCard}>
              {/* Stat 1: Rank */}
              <View style={styles.hudStatCol}>
                <Text style={styles.hudStatLabel}>RANK</Text>
                <Text style={styles.hudStatValueWhite}>
                  #{userRank}
                </Text>
                <Text style={styles.hudStatSubtext}>Global</Text>
              </View>

              <View style={styles.hudDivider} />

              {/* Stat 2: Total XP (Center Highlight) */}
              <View style={[styles.hudStatCol, styles.hudStatColCenter]}>
                <Text style={styles.hudStatLabel}>TOTAL XP</Text>
                <View style={styles.hudScoreRow}>
                  <Text style={styles.hudScoreValueText}>
                    {formatScore(totalXp)}
                  </Text>
                  <Text style={styles.hudScoreUnitText}> XP</Text>
                </View>
                <Text style={styles.hudStatSubtext}>Earned</Text>
              </View>

              <View style={styles.hudDivider} />

              {/* Stat 3: Level */}
              <View style={styles.hudStatCol}>
                <Text style={styles.hudStatLabel}>LEVEL</Text>
                <Text style={styles.hudStatValueWhite}>
                  Lv. {userLevel}
                </Text>
                <Text style={styles.hudStatSubtext}>{percentile}</Text>
              </View>
            </View>

            {/* MOTIVATIONAL CREED RIBBON */}
            <View style={styles.creedCard}>
              <View style={styles.creedAccentBar} />
              <View style={styles.creedContent}>
                <View style={styles.creedHeaderRow}>
                  <FontAwesome5 name="quote-left" size={13} color="#EF4444" />
                  <Text style={styles.creedBadgeText}>HUNTER CREED</Text>
                </View>
                <Text style={styles.creedText}>
                  Discipline today, a <Text style={styles.creedHighlight}>stronger</Text> you tomorrow.
                </Text>
                <Text style={styles.creedAuthor}>— HunterX Official</Text>
              </View>
            </View>

            {/* ACTION BUTTON: SHARE RANK */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleShare}
              style={styles.shareBtnTouch}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626', '#991B1B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shareBtnGradient}
              >
                <Ionicons
                  name="share-social-outline"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.shareBtnText}>SHARE YOUR GLORY</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  popupCardContainer: {
    width: '100%',
    maxWidth: 360,
    maxHeight: SCREEN_HEIGHT * 0.90,
    backgroundColor: '#09090C',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.55)',
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 16,
  },
  cardBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    alignItems: 'center',
  },

  /* HEADER BAR */
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.15)',
    zIndex: 20,
  },
  brandContainer: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  brandTitleWhite: {
    color: '#FFFFFF',
  },
  brandTitleRed: {
    color: '#EF4444',
  },
  brandSubtitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 8,
    fontWeight: '800',
    color: '#A1A1AA',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* PRESTIGE CROWN BADGE */
  prestigeBadgeWrapper: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  prestigePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  prestigeCrownIcon: {
    marginRight: 6,
  },
  prestigeBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  prestigeTagline: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 1.5,
    marginTop: 5,
    textTransform: 'uppercase',
  },

  /* HERO AVATAR SHOWCASE */
  avatarShowcaseSection: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  avatarOuterPulseRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    position: 'relative',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarInnerGlowRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: '#EF4444',
    overflow: 'hidden',
    backgroundColor: '#120406',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  floatingRankBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 6,
  },
  floatingRankText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  hunterDisplayName: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginTop: 8,
  },
  hunterStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  hunterStatusText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    fontWeight: '600',
    color: '#A1A1AA',
    letterSpacing: 0.3,
  },

  /* 3-PILLAR STATS HUD */
  statsHudCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(18, 10, 14, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  hudStatCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudStatColCenter: {
    flex: 1.2,
  },
  hudDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  hudStatLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  hudStatValueWhite: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  hudScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  hudScoreValueText: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  hudScoreUnitText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  hudStatSubtext: {
    fontFamily: fontFamilies.medium,
    fontSize: 9.5,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 2,
  },

  /* MOTIVATIONAL CREED RIBBON */
  creedCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: 'rgba(18, 10, 14, 0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.22)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  creedAccentBar: {
    width: 4,
    backgroundColor: '#EF4444',
  },
  creedContent: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  creedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  creedBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 8.5,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  creedText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#F4F4F5',
    lineHeight: 16,
  },
  creedHighlight: {
    fontFamily: fontFamilies.bold,
    color: '#EF4444',
    fontWeight: '800',
  },
  creedAuthor: {
    fontFamily: fontFamilies.regular,
    fontSize: 9.5,
    color: '#71717A',
    marginTop: 4,
  },

  /* SHARE BUTTON */
  shareBtnTouch: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  shareBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  shareBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});