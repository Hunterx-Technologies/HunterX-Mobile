import React, { useRef } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

import ViewShot from '@/components/common/ViewShotCompat';
import type { ViewShotHandle } from '@/types/viewShot';
import RNShare from '@/services/share/RNShare';
import { fontFamilies } from '@/theme/typography';
import type { LeaderboardMe } from '@/types/leaderboard';

const TOP5_BG = require('@/assets/images/top5bg.jpg');
const FALLBACK_AVATAR = 'https://res.cloudinary.com/sc8zzixt/image/upload/w_96,h_96,c_fill/f_auto,q_auto/v1788468328/hunterx/app-assets/arise_avatar_11.jpg';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LeaderboardTop5ModalProps {
  visible: boolean;
  onClose: () => void;
  me: LeaderboardMe | null;
}

// Ranks 1-3 get their exact number, 4-5 round up to "Top 5", and
// everything past that rounds up to the nearest 10% bracket (7% -> "Top
// 10%", 24% -> "Top 30%") rather than an oddly-precise percentage.
function topBracketLabel(rank: number | null | undefined, topPercent: number | null | undefined): string {
  if (rank == null) return 'Ranked';
  if (rank <= 3) return `Top ${rank}`;
  if (rank <= 5) return 'Top 5';
  if (topPercent != null) {
    const bracket = Math.max(10, Math.ceil(topPercent / 10) * 10);
    return `Top ${bracket}%`;
  }
  return `Rank #${rank}`;
}

export const LeaderboardTop5Modal: React.FC<LeaderboardTop5ModalProps> = ({
  visible,
  onClose,
  me,
}) => {
  // Only ever opened from the "You" card while me.status === 'ranked',
  // but guard anyway rather than crash if that ever changes.
  const totalXp = me?.totalXp ?? 0;
  const userLevel = me?.level ?? 1;
  const userRank = me?.rank;
  const avatarUrl = me?.avatarThumbUrl || FALLBACK_AVATAR;
  const bracketLabel = topBracketLabel(me?.rank, me?.topPercent);
  const shareCardRef = useRef<ViewShotHandle>(null);

  const formatScore = (val: number) => {
    return val.toLocaleString('en-US');
  };

  const handleShare = async () => {
    const shareMessage = `🔥 I just reached ${bracketLabel} on HunterX! Discipline today, a stronger you tomorrow. Check out your rank on HunterX!`;

    try {
      const cardImageUri = await shareCardRef.current?.capture?.();
      await RNShare.open({
        title: 'HunterX',
        message: shareMessage,
        url: cardImageUri,
        failOnCancel: false,
      });
    } catch (error: any) {
      if (error?.message === 'User did not share') return;
      try {
        await Share.share({ message: shareMessage, title: 'HunterX' });
      } catch {}
    }
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

        {/* POPUP CONTAINER CARD */}
        <View style={styles.popupCardContainer}>
          {/* Background Artwork */}
          <Image
            source={TOP5_BG}
            style={styles.cardBgImage}
            resizeMode="cover"
          />

          {/* Vignette Gradient Overlays */}
          <LinearGradient
            colors={[
              'rgba(2, 2, 3, 0.75)',
              'rgba(2, 2, 3, 0.35)',
              'rgba(2, 2, 3, 0.65)',
              '#020203',
            ]}
            locations={[0, 0.25, 0.65, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* HEADER BAR */}
          <View style={styles.headerBar}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="share" size={19} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              <Text style={styles.headerTitleWhite}>You</Text>
            </Text>

            {/* Close 'X' Button on Right */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            bounces={false}
            overScrollMode="never"
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Everything from here down is what gets captured and shared
                as the card image — the header bar's share/close buttons
                stay outside it. Has its own background since the big
                artwork image above is a sibling, not an ancestor, of this
                subtree. */}
            <ViewShot
              ref={shareCardRef}
              options={{ format: 'png', quality: 1 }}
              style={styles.shareCaptureWrapper}
            >

            {/* TOP BRANDING ROW */}
            <View style={styles.topBrandingRow}>
              {/* Left Brand Info */}
              <View style={styles.brandCol}>
                <Text style={styles.brandTitle}>
                  <Text style={styles.brandTitleWhite}>Hunter</Text>
                  <Text style={styles.brandTitleRed}>X</Text>
                </Text>
                <Text style={styles.brandSubtitle}>
                  AWAKEN. HUNT. ASCEND.
                </Text>
              </View>
            </View>

            {/* MAIN TOP 5 RANK CARD */}
            <View style={styles.mainCard}>
              {/* Crown + TOP 5 Header */}
              <View style={styles.top5HeaderRow}>
                <FontAwesome5
                  name="crown"
                  size={18}
                  color="#FE5B01"
                  style={styles.crownIcon}
                />
                <Text style={styles.top5TitleText}>{bracketLabel.toUpperCase()}</Text>
              </View>

              {/* Circular Avatar with Floating Rank Tag */}
              <View style={styles.avatarWrap}>
                <View style={styles.avatarGlowRing}>
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Rank Tag Badge */}
                <View style={styles.rankBadgePill}>
                  <Text style={styles.rankBadgeText}>#{userRank ?? '—'}</Text>
                </View>
              </View>

              {/* XP Score */}
              <View style={styles.scoreRow}>
                <Text style={styles.scoreNumberText}>{formatScore(totalXp)}</Text>
                <Text style={styles.scoreXpText}> XP</Text>
              </View>

              {/* Level Pill */}
              <View style={styles.levelPill}>
                <Text style={styles.levelPrefixText}>Lv. </Text>
                <Text style={styles.levelNumberText}>{userLevel}</Text>
              </View>
            </View>

            {/* BOTTOM QUOTE CARD */}
            <View style={styles.quoteCard}>
              {/* Left & Right Orange Quote Marks */}
              <FontAwesome5
                name="quote-left"
                size={16}
                color="#FE5B01"
                style={styles.quoteIconLeft}
              />
              <FontAwesome5
                name="quote-right"
                size={16}
                color="#FE5B01"
                style={styles.quoteIconRight}
              />

              {/* Quote Content */}
              <View style={styles.quoteBody}>
                <Text style={styles.quoteMainText}>
                  Discipline today,{'\n'}a{' '}
                  <Text style={styles.quoteHighlight}>stronger</Text> you
                  tomorrow.
                </Text>
                <Text style={styles.quoteAuthor}>— HunterX</Text>
              </View>
            </View>
            </ViewShot>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  popupCardContainer: {
    width: '100%',
    maxWidth: 355,
    maxHeight: SCREEN_HEIGHT * 0.90,
    backgroundColor: '#020203',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: 'rgba(254, 91, 1, 0.50)',
    overflow: 'hidden',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
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
    paddingBottom: 16,
  },
  shareCaptureWrapper: {
    backgroundColor: 'transparent',
    paddingTop: 4,
    paddingBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },

  /* HEADER BAR */
  headerBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 30,
  },
  closeBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerTitleWhite: {
    color: '#FFFFFF',
  },
  headerTitleRed: {
    color: '#FE5B01',
  },
  shareBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* TOP BRANDING ROW */
  topBrandingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 12,
    marginBottom: 14,
  },
  brandCol: {
    alignItems: 'flex-start',
  },
  brandTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  brandTitleWhite: {
    color: '#FFFFFF',
  },
  brandTitleRed: {
    color: '#FE5B01',
  },
  brandSubtitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 7.5,
    fontWeight: '800',
    color: '#8D98A3',
    letterSpacing: 1.1,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  rightSloganCol: {
    alignItems: 'flex-end',
    transform: [{ rotate: '-8deg' }],
  },
  sloganText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '800',
    color: '#FE5B01',
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  sloganUnderline: {
    width: 30,
    height: 2,
    backgroundColor: '#FE5B01',
    borderRadius: 1,
    marginTop: 2,
  },

  /* MAIN TOP 5 RANK CARD */
  mainCard: {
    marginHorizontal: 22,
    backgroundColor: 'rgba(13, 17, 20, 0.85)',
    borderRadius: 18,
    borderWidth: 1.1,
    borderColor: 'rgba(254, 91, 1, 0.45)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  top5HeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownIcon: {
    marginRight: 8,
  },
  top5TitleText: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },

  /* AVATAR & RANK BADGE */
  avatarWrap: {
    width: 86,
    height: 86,
    marginVertical: 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlowRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1.8,
    borderColor: '#FE5B01',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1114',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  avatarImage: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  rankBadgePill: {
    position: 'absolute',
    top: 0,
    right: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#180A04',
    borderWidth: 1.2,
    borderColor: '#FE5B01',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 4,
  },
  rankBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  /* SCORE */
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  scoreNumberText: {
    fontFamily: fontFamilies.bold,
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  scoreXpText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FE5B01',
    letterSpacing: 0.5,
  },

  /* LEVEL PILL */
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 10, 4, 0.75)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 8,
  },
  levelPrefixText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    fontWeight: '500',
    color: '#8D98A3',
  },
  levelNumberText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* BOTTOM QUOTE CARD */
  quoteCard: {
    marginHorizontal: 22,
    marginTop: 10,
    backgroundColor: 'rgba(13, 17, 20, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.35)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    position: 'relative',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  quoteIconLeft: {
    position: 'absolute',
    top: 10,
    left: 12,
  },
  quoteIconRight: {
    position: 'absolute',
    bottom: 10,
    right: 12,
  },
  quoteBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  quoteMainText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '600',
    color: '#F4F5F6',
    textAlign: 'center',
    lineHeight: 17,
  },
  quoteHighlight: {
    fontFamily: fontFamilies.bold,
    color: '#FE5B01',
    fontWeight: '800',
  },
  quoteAuthor: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: '#8D98A3',
    marginTop: 4,
    textAlign: 'center',
  },
});
