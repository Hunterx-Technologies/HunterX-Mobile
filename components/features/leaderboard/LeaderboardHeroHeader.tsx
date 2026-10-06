import React from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { fontFamilies } from '@/theme/typography';
import { DustParticles } from '@/components/common/DustParticles';

const LEADERBOARD_HERO_BG = require('@/assets/images/leaderboardone.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Scale the hero with screen width so the artwork keeps its framing on
// small and large phones alike.
export const HERO_HEIGHT = Math.round(Math.min(Math.max(SCREEN_WIDTH * 0.82, 290), 360));
// How far down the hero the scrolling panel stops when swiping up — the
// "Leaderboard" title + filter pills stick here and rows scroll under them,
// so the top of the artwork (and the brand) always stay visible.
export const HERO_STOP = Math.round(HERO_HEIGHT * 0.42);
// Height of the title block that sticks at HERO_STOP.
export const HERO_TITLE_HEIGHT = 56;
// Transparent gap above the title at rest, so it sits at the hero's bottom.
export const HERO_SPACER = HERO_HEIGHT - HERO_STOP - HERO_TITLE_HEIGHT;
// Scroll distance over which the stuck title turns opaque.
const STICK_FADE = 40;
const STICK_EDGE_HEIGHT = 48;

/** 0 at rest → 1 once the title is stuck at HERO_STOP. */
const stuckProgress = (scrollY: Animated.Value) =>
  scrollY.interpolate({
    inputRange: [HERO_SPACER - STICK_FADE, HERO_SPACER],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

interface LeaderboardHeroBackgroundProps {
  /** Scroll offset of the list rendered above this background. */
  scrollY: Animated.Value;
  /** Distance from the screen top to the hero (status bar inset). */
  top: number;
}

/**
 * Fixed artwork behind the leaderboard list. Swiping up leaves it in place
 * while the content slides over it; pulling down (iOS overscroll) moves it
 * down with the content so the pull still feels natural.
 */
export const LeaderboardHeroBackground: React.FC<LeaderboardHeroBackgroundProps> = ({
  scrollY,
  top,
}) => {
  const translateY = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0],
    outputRange: [HERO_HEIGHT, 0],
    extrapolateRight: 'clamp',
  });
  // Dim the artwork slightly as the panel rises over it.
  const opacity = scrollY.interpolate({
    inputRange: [0, HERO_SPACER],
    outputRange: [1, 0.75],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.backgroundLayer, { top, opacity, transform: [{ translateY }] }]}
    >
      {/* Background Graphic: leaderboardone.png covering the hero */}
      <Animated.Image
        source={LEADERBOARD_HERO_BG}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Floating Red Dust Particles */}
      <DustParticles count={30} color="#FF4500" />

      {/* Top fade from the #09090B status-bar strip into the artwork, so the
          image edge blends with the page instead of a hard line */}
      <LinearGradient
        colors={['#09090B', 'rgba(9, 9, 11, 0.7)', 'rgba(9, 9, 11, 0.25)', 'transparent']}
        locations={[0, 0.12, 0.3, 0.5]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Bottom smooth fade to #09090B page canvas */}
      <LinearGradient
        colors={['transparent', 'rgba(9, 9, 11, 0.75)', '#09090B']}
        locations={[0.5, 0.8, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Once the title is stuck, fade the artwork into it so there's no
          hard edge above the opaque title block */}
      <Animated.View style={[styles.stickEdge, { opacity: stuckProgress(scrollY) }]}>
        <LinearGradient
          colors={['rgba(9, 9, 11, 0)', '#09090B']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </Animated.View>
  );
};

/**
 * Fixed HunterX brand bar. It stays put while swiping up (the panel stops at
 * HERO_STOP, below it) and moves down with the artwork on pull-down.
 */
export const LeaderboardBrandBar: React.FC<LeaderboardHeroBackgroundProps> = ({ scrollY, top }) => {
  const translateY = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0],
    outputRange: [HERO_HEIGHT, 0],
    extrapolateRight: 'clamp',
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.brandBar, { transform: [{ translateY }] }]}>
      <View style={[styles.topNavRow, { paddingTop: top + 14 }]}>
        {/* Left: HunterX Brand Title + Tagline */}
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <Text style={styles.brandHunter}>Hunter</Text>
            <Text style={styles.brandX}>X</Text>
          </View>
          <Text style={styles.brandSubtitle}>AWAKEN. HUNT. ASCEND.</Text>
        </View>
      </View>
    </Animated.View>
  );
};

interface LeaderboardHeroHeaderProps {
  scrollY: Animated.Value;
}

/**
 * "Leaderboard" title block. Rendered inside the sticky part of the list so
 * it stops at HERO_STOP. Transparent over the artwork at rest; turns opaque
 * as it sticks so rows scrolling beneath never show through.
 */
export const LeaderboardHeroHeader: React.FC<LeaderboardHeroHeaderProps> = ({ scrollY }) => {
  return (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={['rgba(9, 9, 11, 0)', 'rgba(9, 9, 11, 0.8)', '#09090B']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[styles.stuckBackdrop, { opacity: stuckProgress(scrollY) }]} />
      {/* MIDDLE & BOTTOM SECTION */}
      <View style={styles.contentSection}>
        <View style={styles.bottomRow}>
          <Text style={styles.screenMainTitle}>Leaderboard</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backgroundLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  stickEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: HERO_STOP - STICK_EDGE_HEIGHT,
    height: STICK_EDGE_HEIGHT,
  },
  stuckBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090B',
  },
  headerContainer: {
    width: '100%',
    height: HERO_TITLE_HEIGHT,
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  brandBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  brandBlock: {
    alignItems: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandHunter: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    fontWeight: '800',
    color: '#F4F5F6',
    letterSpacing: 0.2,
  },
  brandX: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    fontWeight: '900',
    color: '#FE5B01',
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 8,
    fontWeight: '800',
    color: '#8D98A3',
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: 'uppercase',
  },

  /* Middle & Bottom Sections */
  contentSection: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    zIndex: 15,
  },
  leftCreedCol: {
    alignSelf: 'flex-start',
    transform: [{ rotate: '-10deg' }],
    marginBottom: 16,
    marginLeft: 6,
  },
  creedHandwritten: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '900',
    color: '#FE5B01',
    letterSpacing: 1,
    lineHeight: 18,
    textShadowColor: 'rgba(254, 91, 1, 0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  screenMainTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 32,
    fontWeight: '800',
    color: '#F4F5F6',
    letterSpacing: 0.2,
  },
  creedPillarsCol: {
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  creedPillarText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    fontWeight: '800',
    color: '#8D98A3',
    letterSpacing: 1.2,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
});
