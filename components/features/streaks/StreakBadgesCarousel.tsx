import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@/theme/typography';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useStreakBadgeStore } from '@/store/useStreakBadgeStore';
import { STREAK_BADGE_ASSETS, STREAK_BADGE_WIDTH } from '@/constants/cloudinaryAssets';
import { optimizeCloudinaryUrl } from '@/services/media/cloudinary';

export interface StreakBadgeItem {
  id: number;
  dayNumber: number;
  daysText: string;
  title: string;
  imageSource: { uri: string };
}

export interface UserBadgeData {
  badge_id?: number;
  name?: string;
  description?: string;
  milestone_days?: number;
  earned_at?: string;
}

const badgeImage = (asset: { uri: string }) => ({
  uri: optimizeCloudinaryUrl(asset.uri, STREAK_BADGE_WIDTH),
});

/**
 * Badge artwork from Cloudinary. expo-image's disk cache keeps the file across
 * app launches, so each badge downloads once and loads from disk afterwards
 * (the URLs are versioned, so a re-uploaded badge gets a fresh download).
 */
export const StreakBadgeImage: React.FC<{
  badge: StreakBadgeItem;
  style?: React.ComponentProps<typeof Image>['style'];
  tintColor?: string;
}> = ({ badge, style, tintColor }) => (
  <Image
    source={badge.imageSource}
    style={style}
    tintColor={tintColor}
    contentFit="contain"
    cachePolicy="memory-disk"
  />
);

export const STREAK_BADGES_DATA: StreakBadgeItem[] = [
  {
    id: 1,
    dayNumber: 7,
    daysText: '7 days',
    title: 'Ember Vow',
    imageSource: badgeImage(STREAK_BADGE_ASSETS.ember_vow),
  },
  {
    id: 2,
    dayNumber: 14,
    daysText: '14 days',
    title: 'Iron Resolve',
    imageSource: badgeImage(STREAK_BADGE_ASSETS.iron_resolve),
  },
  {
    id: 3,
    dayNumber: 30,
    daysText: '30 days',
    title: 'Shadow Oath',
    imageSource: badgeImage(STREAK_BADGE_ASSETS.shadow_oath),
  },
  {
    id: 4,
    dayNumber: 60,
    daysText: '60 days',
    title: 'Phantom Discipline',
    imageSource: badgeImage(STREAK_BADGE_ASSETS.phantom_discipline),
  },
  {
    id: 5,
    dayNumber: 90,
    daysText: '90 days',
    title: 'Sovereign Will',
    imageSource: badgeImage(STREAK_BADGE_ASSETS.sovereign_will),
  },
  {
    id: 6,
    dayNumber: 200,
    daysText: '200 days',
    title: 'Void Ascendant',
    imageSource: badgeImage(STREAK_BADGE_ASSETS.void_ascendant),
  },
  {
    id: 7,
    dayNumber: 365,
    daysText: '365 days',
    title: 'Eternal Hunter',
    imageSource: badgeImage(STREAK_BADGE_ASSETS.eternal_hunter),
  },
];

interface StreakBadgesCarouselProps {
  currentStreak?: number; // Current user streak days
  userBadges?: UserBadgeData[]; // User's earned badges array from API
  onBadgePress?: (badge: StreakBadgeItem) => void;
}

export const StreakBadgesCarousel: React.FC<StreakBadgesCarouselProps> = ({
  currentStreak = 0,
  userBadges,
  onBadgePress,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const slotRefs = useRef<Record<number, View | null>>({});
  const earnedIds = useStreakBadgeStore((s) => s.earnedIds);

  // Dynamic width measurement for 100% precision across all mobile devices
  const availableWidth = measuredWidth > 0 ? measuredWidth : Math.max(280, windowWidth - 48);
  const cardGap = 6;
  const itemsPerPage = 4;
  const cardWidth = Math.floor((availableWidth - cardGap * (itemsPerPage - 1)) / itemsPerPage);

  // Total pages calculation (4 badges per page view)
  const totalPages = Math.ceil(STREAK_BADGES_DATA.length / itemsPerPage);

  // Lets the streak badge popup fly a newly earned badge into its slot:
  // expands the section, pages to the badge, scrolls home so it's in view,
  // then reports where the slot is on screen.
  const collapsedRef = useRef(isCollapsed);
  collapsedRef.current = isCollapsed;
  useEffect(() => {
    const measure = (id: number) =>
      new Promise<{ x: number; y: number; width: number; height: number } | null>((resolve) => {
        const view = slotRefs.current[id];
        if (!view) return resolve(null);
        view.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
      });
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    return useStreakBadgeStore.getState().setLocator(async (id) => {
      const index = STREAK_BADGES_DATA.findIndex((b) => b.id === id);
      if (index < 0) return null;
      if (collapsedRef.current) {
        setIsCollapsed(false);
        await wait(80);
      }
      const page = Math.floor(index / itemsPerPage);
      scrollViewRef.current?.scrollTo({ x: page * (cardWidth + cardGap) * itemsPerPage, animated: false });
      setActivePageIndex(page);
      await wait(40);

      let rect = await measure(id);
      const screenH = Dimensions.get('window').height;
      const scrollHome = useStreakBadgeStore.getState().homeScroller;
      if (rect && scrollHome && (rect.y < screenH * 0.2 || rect.y + rect.height > screenH * 0.75)) {
        scrollHome(rect.y - screenH * 0.45);
        await wait(450);
        rect = (await measure(id)) ?? rect;
      }
      return rect;
    });
  }, [cardWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && Math.abs(width - measuredWidth) > 2) {
      setMeasuredWidth(width);
    }
  };

  const handleToggleCollapse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsCollapsed((prev) => !prev);
  };

  const handlePressBadge = (badge: StreakBadgeItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onBadgePress) {
      onBadgePress(badge);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const pageLength = (cardWidth + cardGap) * itemsPerPage;
    if (pageLength > 0) {
      const pageIndex = Math.round(contentOffsetX / pageLength);
      const clampedPage = Math.min(totalPages - 1, Math.max(0, pageIndex));
      if (clampedPage !== activePageIndex) {
        setActivePageIndex(clampedPage);
      }
    }
  };

  return (
    <View style={styles.carouselContainer} onLayout={handleLayout}>
      {/* Top Header Row with Title and Collapse Chevron */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleToggleCollapse}
        style={styles.headerRow}
      >
        <Text style={styles.headerTitle}>Badges</Text>
        <Ionicons
          name={isCollapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          color="#9CA3AF"
        />
      </TouchableOpacity>

      {/* Expandable Carousel Content */}
      {!isCollapsed && (
        <View style={styles.contentWrapper}>
          {/* Horizontal Manual Carousel showing 4 items per screen view */}
          <ScrollView
            bounces={false}
            overScrollMode="never"
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={(cardWidth + cardGap) * itemsPerPage}
            decelerationRate="fast"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={[styles.scrollContent, { gap: cardGap }]}
          >
            {STREAK_BADGES_DATA.map((badge) => {
              // Unlocked only if present in userBadges array from API, fallback to streak days
              const isUnlocked =
                Array.isArray(userBadges) && userBadges.length > 0
                  ? userBadges.some(
                      (b) =>
                        b.milestone_days === badge.dayNumber ||
                        (b.name && b.name.toLowerCase() === badge.title.toLowerCase())
                    )
                  : currentStreak >= badge.dayNumber;
              const isEarned = isUnlocked || earnedIds.includes(badge.id);

              return (
                <TouchableOpacity
                  key={badge.id}
                  activeOpacity={0.8}
                  onPress={() => handlePressBadge(badge)}
                  style={[styles.badgeItemContainer, { width: cardWidth }]}
                >
                  {/* Badge Graphic (Top) */}
                  <LandingPop badgeId={badge.id}>
                  <View
                    ref={(view) => {
                      slotRefs.current[badge.id] = view;
                    }}
                    collapsable={false}
                    style={styles.imageWrapper}
                  >
                    <StreakBadgeImage
                      badge={badge}
                      style={[styles.badgeImage, !isEarned && styles.badgeImageMuted]}
                    />
                    {!isEarned && (
                      <View style={styles.normalLockOverlay}>
                        <Ionicons name="lock-closed" size={13} color="#A1A1AA" />
                      </View>
                    )}
                  </View>
                  </LandingPop>

                  {/* Days Text (Middle: e.g. "7 days") */}
                  <Text
                    style={[styles.daysText, isEarned ? styles.daysTextUnlocked : styles.daysTextLocked]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {badge.daysText}
                  </Text>

                  {/* Badge Title (Bottom: e.g. "Ember Vow") */}
                  <Text
                    style={[styles.badgeTitle, isEarned ? styles.badgeTitleUnlocked : styles.badgeTitleMuted]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {badge.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Pagination Dots (Below Carousel) */}
          <View style={styles.paginationRow}>
            {Array.from({ length: totalPages }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === activePageIndex ? styles.paginationDotActive : styles.paginationDotInactive,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

/** Pops the slot with a glowing ring when the streak badge popup lands this badge here. */
const LandingPop: React.FC<{ badgeId: number; children: React.ReactNode }> = ({ badgeId, children }) => {
  const landing = useStreakBadgeStore((s) => s.landing);
  const pop = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (landing?.id !== badgeId) return;
    pop.value = withSequence(withTiming(1.45, { duration: 140 }), withSpring(1, { damping: 7, stiffness: 180 }));
    ring.value = 0;
    ring.value = withTiming(1, { duration: 900 });
  }, [landing, badgeId, pop, ring]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 && ring.value < 1 ? (1 - ring.value) * 0.9 : 0,
    transform: [{ scale: 0.8 + ring.value * 0.9 }],
  }));

  return (
    <View style={styles.landingWrap}>
      <Animated.View style={[styles.landingRing, ringStyle]} pointerEvents="none" />
      <Animated.View style={popStyle}>{children}</Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  landingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FE5B01',
    top: -2,
  },
  carouselContainer: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F1F26',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingVertical: 2,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  contentWrapper: {
    marginTop: 2,
  },
  scrollContent: {
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  badgeItemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 2,
  },
  imageWrapper: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  badgeImage: {
    width: 46,
    height: 46,
  },
  badgeImageMuted: {
    opacity: 0.25,
  },
  normalLockOverlay: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(24, 24, 27, 0.85)',
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    marginBottom: 1,
    textAlign: 'center',
  },
  daysTextUnlocked: {
    color: '#FFFFFF',
  },
  daysTextLocked: {
    color: '#71717A',
  },
  badgeTitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    textAlign: 'center',
  },
  badgeTitleUnlocked: {
    color: '#E4E4E7',
  },
  badgeTitleMuted: {
    color: '#52525B',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  paginationDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  paginationDotInactive: {
    backgroundColor: '#3F3F46',
  },
});
