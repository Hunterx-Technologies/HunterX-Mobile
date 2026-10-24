import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

import { fontFamilies } from '@/theme/typography';
import { STREAK_BADGES_DATA, StreakBadgeImage, type StreakBadgeItem } from './StreakBadgesCarousel';

// Streak badge "vault": the badge already earned peeks in on the left, the
// current one sits sealed in stone in the middle, and the next one waits
// locked on the right. Tapping the stone cracks it twice, the third tap
// shatters it and reveals the badge (sound + haptics). Swipe to browse.
//
// Usually shown as a popup with showStreakBadge() (GlobalStreakBadge is
// mounted in the root layout); <StreakBadgeShowcaseModal /> and
// <StreakBadgeShowcase /> are there for screens that manage it themselves.

const ORANGE = '#FE5B01';
const STONE = '#1B1C21';
const STONE_EDGE = '#34353D';

/** Glow color per badge, matched to its artwork. */
const BADGE_ACCENT: Record<number, string> = {
  1: '#8CC4FF',
  2: '#6EC8FF',
  3: '#A66BFF',
  4: '#9B5CFF',
  5: '#FFC23D',
  6: '#8E5BFF',
  7: '#FFD27A',
};

/** Copy per badge: before (sealed) and after (unlocked). */
const BADGE_COPY: Record<number, { sealed: string; unlocked: string }> = {
  1: { sealed: 'Keep your streak for 7 days to break the seal.', unlocked: 'Your first flame is lit. The hunt has begun.' },
  2: { sealed: 'Hold your streak for 14 days to break the seal.', unlocked: 'Two weeks strong. Your resolve is iron.' },
  3: { sealed: 'Hold your streak for 30 days to break the seal.', unlocked: 'A full month kept. The shadows bow to you.' },
  4: { sealed: 'Hold your streak for 60 days to break the seal.', unlocked: 'Sixty days of discipline. You move like a phantom.' },
  5: { sealed: 'Hold your streak for 90 days to break the seal.', unlocked: 'Ninety days. Your will rules your days.' },
  6: { sealed: 'Hold your streak for 200 days to break the seal.', unlocked: 'Two hundred days. You have risen past the void.' },
  7: { sealed: 'Hold your streak for 365 days to break the seal.', unlocked: 'A full year. You are the Eternal Hunter.' },
};

const TAPS_TO_OPEN = 3;


// Vertical layout (points), matching the reward screens: the copy sits just
// under the ✕, the badge is centered in the space left, and the button keeps
// a gap below it.
/** From the safe area top to the copy (the ✕ row plus a gap). */
const HEADER_TOP = 58;
const BUTTON_HEIGHT = 50;
/** Smallest gap under the button. */
const BUTTON_BOTTOM_GAP = 48;
/** Minimum space between the copy, the badge block and the button. */
const BLOCK_GAP = 20;
/** Room under the badge for the "TAP TO CRACK" prompt, as a share of the badge size. */
const PROMPT_SPACE = 0.32;

// Opening → the badge flies from its home slot to the center, the stone seal
// locks over it, then the vault fades in around it (ms).
const INTRO_FLY_MS = 850;
const INTRO_SEAL_MS = 520;
const INTRO_REVEAL_MS = 480;
/** How long to wait for the home slot before opening without the flight. */
const INTRO_SOURCE_TIMEOUT_MS = 1500;
const INTRO_ARC = 90;

// Continue → fly to the home badge slot (ms).
const FLY_MS = 760;
const LAND_MS = 560;
/** How high the badge arcs above the straight line while flying. */
const FLY_ARC = 140;

export interface FlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const measureInWindow = (view: View | null) =>
  new Promise<FlightRect | null>((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
  });

/** Starry cavern backdrop; the rock platform's top surface is at PLINTH_Y. */
const VAULT_BG = require('../../../assets/images/streak-badges/streak_vault_bg.jpg');
const VAULT_BG_W = 920;
const VAULT_BG_H = 1710;
const VAULT_BG_PLINTH_Y = 1112;
const VAULT_BG_COLOR = '#010002';
const TOP_FADE = 90;

// ---------------------------------------------------------------------------

const clamp = Extrapolation.CLAMP;
const cubicOut = Easing.out(Easing.cubic);
const backOut = Easing.out(Easing.back(1.7));

/** Cracks in a 100x100 box, grouped by the tap that opens them. */
const CRACKS: string[][] = [
  ['M50,30 L46,40 L52,47 L47,58', 'M52,47 L60,50 L66,46'],
  ['M47,58 L41,64 L43,72', 'M46,40 L37,38 L32,44', 'M60,50 L63,60 L70,64', 'M50,30 L55,24 L61,26'],
];

const SHARDS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + (i % 2 ? 0.2 : -0.15);
  const r = 0.14 + (i % 3) * 0.05;
  return {
    x: Math.cos(a) * r,
    y: Math.sin(a) * r,
    vx: Math.cos(a) * (0.55 + (i % 4) * 0.12),
    vy: Math.sin(a) * (0.5 + (i % 3) * 0.12) - 0.25,
    rot: (i % 2 ? 1 : -1) * (120 + i * 17),
    size: 0.07 + (i % 4) * 0.025,
    points: i % 3 === 0 ? '0,-1 1,0.4 -0.6,0.9' : i % 3 === 1 ? '-0.8,-0.8 0.9,-0.3 0.2,1 -1,0.3' : '0,-1 0.9,-0.1 0.4,0.9 -0.9,0.5',
  };
});

const EMBERS = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * 37) % 100) / 100,
  delay: (i * 0.137) % 1,
  size: 1.5 + (i % 3),
  drift: (i % 2 ? 1 : -1) * (6 + (i % 4) * 4),
}));

// ---------------------------------------------------------------------------

type SlotState = 'unlocked' | 'current' | 'locked';

interface SlotProps {
  badge: StreakBadgeItem;
  /** Position relative to the center: -1 left, 0 center, 1 right (animated). */
  pos: SharedValue<number>;
  offset: number;
  state: SlotState;
  size: number;
  stageWidth: number;
  shake: SharedValue<number>;
  crack: SharedValue<number>;
  shatter: SharedValue<number>;
}

const BadgeSlot: React.FC<SlotProps> = ({ badge, pos, offset, state, size, stageWidth, shake, crack, shatter }) => {
  const accent = BADGE_ACCENT[badge.id] || ORANGE;
  const isCurrent = state === 'current';
  const sideScale = 0.66;

  const slotStyle = useAnimatedStyle(() => {
    const p = offset - pos.value;
    const cx = interpolate(p, [-2, -1, 0, 1, 2], [-stageWidth * 0.6, -size * 0.12, stageWidth / 2, stageWidth + size * 0.12, stageWidth * 1.6], clamp);
    const s = interpolate(Math.abs(p), [0, 1, 2], [1, sideScale, 0.5], clamp);
    const op = interpolate(Math.abs(p), [0, 1, 1.8], [1, 0.75, 0], clamp);
    return {
      opacity: op,
      transform: [
        { translateX: cx - size / 2 + (isCurrent ? shake.value : 0) },
        { scale: s },
      ],
    };
  });

  // Stone shell: always on for locked badges; on the current one until it shatters.
  const shellStyle = useAnimatedStyle(() => ({
    opacity: state === 'locked' ? 1 : state === 'current' ? 1 - interpolate(shatter.value, [0, 0.04], [0, 1], clamp) : 0,
  }));

  const glowStyle = useAnimatedStyle(() => {
    if (state === 'locked') return { opacity: 0 };
    if (state === 'unlocked') return { opacity: 0.55, transform: [{ scale: 1 }] };
    const burst = interpolate(shatter.value, [0, 0.12, 0.6], [0, 1, 0.6], clamp);
    return { opacity: Math.min(1, 0.12 + crack.value * 0.35 + burst), transform: [{ scale: 1 + burst * 0.2 }] };
  });

  const colorStyle = useAnimatedStyle(() => {
    if (state !== 'current') return {};
    const u = shatter.value;
    const pop = interpolate(u, [0, 0.05, 0.35, 0.6], [0.88, 0.88, 1.12, 1], clamp);
    return { transform: [{ scale: u > 0 ? pop : 1 }] };
  });

  const crack1 = useAnimatedStyle(() => ({ opacity: isCurrent ? interpolate(crack.value, [0, 0.5], [0, 1], clamp) : 0 }));
  const crack2 = useAnimatedStyle(() => ({ opacity: isCurrent ? interpolate(crack.value, [0.5, 1], [0, 1], clamp) : 0 }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: isCurrent ? interpolate(shatter.value, [0, 0.03, 0.25], [0, 0.95, 0], clamp) : 0,
  }));

  const ringStyle = useAnimatedStyle(() => {
    const u = isCurrent ? interpolate(shatter.value, [0.02, 0.55], [0, 1], clamp) : 0;
    return { opacity: u > 0 && u < 1 ? (1 - u) * 0.9 : 0, transform: [{ scale: 0.6 + cubicOut(u) * 1.2 }] };
  });

  return (
    <Animated.View style={[styles.slot, { width: size, height: size }, slotStyle]} pointerEvents="none">
      <Animated.View style={[styles.slotGlow, { width: size * 1.7, height: size * 1.7, left: -size * 0.35, top: -size * 0.35 }, glowStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`sbGlow${badge.id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={accent} stopOpacity={0.7} />
              <Stop offset="0.45" stopColor={accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill={`url(#sbGlow${badge.id})`} />
        </Svg>
      </Animated.View>

      {state !== 'locked' && (
        <Animated.View style={[StyleSheet.absoluteFill, colorStyle]}>
          <StreakBadgeImage badge={badge} style={styles.fill} />
        </Animated.View>
      )}

      {state !== 'unlocked' && (
        <Animated.View style={[StyleSheet.absoluteFill, shellStyle]}>
          {/* Bevel edge, stone body, faint carving */}
          <StreakBadgeImage badge={badge} style={[styles.fill, { transform: [{ translateY: -2 }] }]} tintColor={STONE_EDGE} />
          {/* Twice, so soft see-through edges of the artwork stay solid stone */}
          <StreakBadgeImage badge={badge} style={[StyleSheet.absoluteFill, styles.fill]} tintColor={STONE} />
          <StreakBadgeImage badge={badge} style={[StyleSheet.absoluteFill, styles.fill]} tintColor={STONE} />
          <StreakBadgeImage badge={badge} style={[StyleSheet.absoluteFill, styles.fill, { opacity: 0.09 }]} />
          {isCurrent &&
            CRACKS.map((group, g) => (
              <Animated.View key={g} style={[StyleSheet.absoluteFill, g === 0 ? crack1 : crack2]}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100">
                  {group.map((d, i) => (
                    <React.Fragment key={i}>
                      <Path d={d} stroke={accent} strokeOpacity={0.35} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      <Path d={d} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={0.9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </React.Fragment>
                  ))}
                </Svg>
              </Animated.View>
            ))}
        </Animated.View>
      )}

      {state === 'locked' && (
        <View style={styles.lockWrap}>
          <View style={styles.lockBubble}>
            <Ionicons name="lock-closed" size={18} color="#C9CBD1" />
          </View>
        </View>
      )}

      {isCurrent && (
        <>
          <Animated.View style={[styles.slotGlow, { width: size, height: size, left: 0, top: 0 }, ringStyle]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Circle cx={50} cy={50} r={46} stroke={accent} strokeWidth={1.6} fill="none" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.slotGlow, { width: size, height: size, left: 0, top: 0 }, flashStyle]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="sbFlash" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                  <Stop offset="0.6" stopColor={accent} stopOpacity={0.4} />
                  <Stop offset="1" stopColor={accent} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={50} cy={50} r={50} fill="url(#sbFlash)" />
            </Svg>
          </Animated.View>
          {SHARDS.map((shard, i) => (
            <Shard key={i} shard={shard} size={size} shatter={shatter} />
          ))}
        </>
      )}
    </Animated.View>
  );
};

const Shard: React.FC<{ shard: (typeof SHARDS)[number]; size: number; shatter: SharedValue<number> }> = ({ shard, size, shatter }) => {
  const box = shard.size * size;
  const style = useAnimatedStyle(() => {
    const u = shatter.value;
    const t = u * 1.4;
    const x = (shard.x + shard.vx * t) * size;
    const y = (shard.y + shard.vy * t + 0.9 * t * t) * size;
    return {
      opacity: u > 0.01 ? interpolate(u, [0.01, 0.6, 1], [1, 0.8, 0], clamp) : 0,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${shard.rot * u}deg` }],
    };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', left: size / 2 - box / 2, top: size / 2 - box / 2, width: box, height: box }, style]}
    >
      <Svg width={box} height={box} viewBox="-1 -1 2 2">
        <Polygon points={shard.points} fill={STONE} stroke={STONE_EDGE} strokeWidth={0.12} />
      </Svg>
    </Animated.View>
  );
};

const Ember: React.FC<{ ember: (typeof EMBERS)[number]; width: number; height: number; clock: SharedValue<number> }> = ({
  ember,
  width,
  height,
  clock,
}) => {
  const style = useAnimatedStyle(() => {
    const u = (clock.value + ember.delay) % 1;
    return {
      opacity: Math.sin(u * Math.PI) * 0.7,
      transform: [{ translateX: ember.x * width + Math.sin(u * Math.PI * 2) * ember.drift }, { translateY: height * (1 - u) }],
    };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top: 0, width: ember.size, height: ember.size, borderRadius: ember.size, backgroundColor: '#DCE3F0' }, style]}
    />
  );
};

/**
 * Opening: Home dims, the badge leaves its home slot and arcs to the center,
 * then stone closes over it (flash, shake) — the seal locks. It's drawn at
 * the center slot's size and position, so the vault fading in on top lines
 * up exactly.
 */
const IntroFlight: React.FC<{
  badge: StreakBadgeItem;
  accent: string;
  from: FlightRect;
  to: FlightRect;
  dim: SharedValue<number>;
  fly: SharedValue<number>;
  seal: SharedValue<number>;
  reveal: SharedValue<number>;
}> = ({ badge, accent, from, to, dim, fly, seal, reveal }) => {
  const dx = from.x + from.width / 2 - (to.x + to.width / 2);
  const dy = from.y + from.height / 2 - (to.y + to.height / 2);
  const startScale = Math.max(0.15, Math.min(from.width, from.height) / to.width);

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value * 0.78 * (1 - reveal.value) }));
  const layerStyle = useAnimatedStyle(() => ({ opacity: 1 - reveal.value }));

  const badgeStyle = useAnimatedStyle(() => {
    const f = fly.value;
    const e = cubicOut(f);
    // A heavy settle: a short shake while the seal closes.
    const jolt = seal.value > 0 && seal.value < 1 ? Math.sin(seal.value * Math.PI * 7) * (1 - seal.value) * 7 : 0;
    const settle = interpolate(seal.value, [0, 0.18, 0.5, 1], [1, 0.92, 1.03, 1], clamp);
    return {
      transform: [
        { translateX: dx * (1 - e) + jolt },
        { translateY: dy * (1 - e) - INTRO_ARC * Math.sin(Math.PI * f) },
        { scale: (startScale + (1 - startScale) * e) * (1 + 0.1 * Math.sin(Math.PI * f)) * settle },
      ],
    };
  });
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fly.value, [0, 0.3, 1], [0.2, 0.85, 0.6], clamp) * (1 - seal.value * 0.75),
  }));
  const stoneStyle = useAnimatedStyle(() => ({ opacity: interpolate(seal.value, [0, 0.35], [0, 1], clamp) }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: interpolate(seal.value, [0, 0.08, 0.45], [0, 0.85, 0], clamp) }));
  const ringStyle = useAnimatedStyle(() => {
    const u = interpolate(seal.value, [0.02, 0.7], [0, 1], clamp);
    return { opacity: u > 0 && u < 1 ? (1 - u) * 0.8 : 0, transform: [{ scale: 0.7 + cubicOut(u) * 0.9 }] };
  });

  const box = { position: 'absolute' as const, left: to.x, top: to.y, width: to.width, height: to.height };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, layerStyle]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.introDim, dimStyle]} />
      <Animated.View style={[box, badgeStyle]}>
        <Animated.View style={[styles.slotGlow, { width: to.width * 1.7, height: to.width * 1.7, left: -to.width * 0.35, top: -to.width * 0.35 }, glowStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="sbIntroGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={accent} stopOpacity={0.75} />
                <Stop offset="0.5" stopColor={accent} stopOpacity={0.2} />
                <Stop offset="1" stopColor={accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill="url(#sbIntroGlow)" />
          </Svg>
        </Animated.View>
        <StreakBadgeImage badge={badge} style={styles.fill} />
        {/* The seal: same stone as the vault's sealed badge */}
        <Animated.View style={[StyleSheet.absoluteFill, stoneStyle]}>
          <StreakBadgeImage badge={badge} style={[styles.fill, { transform: [{ translateY: -2 }] }]} tintColor={STONE_EDGE} />
          <StreakBadgeImage badge={badge} style={[StyleSheet.absoluteFill, styles.fill]} tintColor={STONE} />
          <StreakBadgeImage badge={badge} style={[StyleSheet.absoluteFill, styles.fill]} tintColor={STONE} />
          <StreakBadgeImage badge={badge} style={[StyleSheet.absoluteFill, styles.fill, { opacity: 0.09 }]} />
        </Animated.View>
        <Animated.View style={[styles.slotGlow, { width: to.width * 1.4, height: to.width * 1.4, left: -to.width * 0.2, top: -to.width * 0.2 }, flashStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="sbIntroFlash" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
                <Stop offset="0.5" stopColor={accent} stopOpacity={0.4} />
                <Stop offset="1" stopColor={accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill="url(#sbIntroFlash)" />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Circle cx={50} cy={50} r={46} stroke={accent} strokeWidth={2} fill="none" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

/** The badge lifting off, flying along an arc with a trail, and landing in its slot. */
const FlyingBadge: React.FC<{
  badge: StreakBadgeItem;
  accent: string;
  from: FlightRect;
  to: FlightRect | null;
  lift: SharedValue<number>;
  fly: SharedValue<number>;
  land: SharedValue<number>;
}> = ({ badge, accent, from, to, lift, fly, land }) => {
  const cx = from.x + from.width / 2;
  const cy = from.y + from.height / 2;
  const tx = to ? to.x + to.width / 2 : cx;
  const ty = to ? to.y + to.height / 2 : cy;
  const endScale = to ? Math.min(to.width, to.height) / from.width : 1;

  const placeAt = (f: number) => {
    'worklet';
    const x = cx + (tx - cx) * f;
    const y = cy + (ty - cy) * f - FLY_ARC * Math.sin(Math.PI * f);
    const lifted = 1 + 0.08 * lift.value;
    const s = lifted + (endScale - lifted) * Math.pow(f, 0.75);
    return [{ translateX: x - cx }, { translateY: y - cy }, { scale: s }, { rotate: `${f * 360}deg` }];
  };

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(land.value, [0, 0.25], [1, 0], clamp),
    transform: placeAt(fly.value),
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fly.value, [0, 0.2, 1], [0.5 + lift.value * 0.4, 0.9, 0.6], clamp) * interpolate(land.value, [0, 0.25], [1, 0], clamp),
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: land.value > 0 ? 1 - land.value : 0,
    transform: [{ scale: 0.4 + cubicOut(land.value) * 1.8 }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(land.value, [0, 0.08, 0.45], [0, 0.9, 0], clamp),
  }));

  const box = { position: 'absolute' as const, left: cx - from.width / 2, top: cy - from.height / 2, width: from.width, height: from.height };
  const burst = Math.max(56, to ? to.width * 2.2 : 0);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[3, 2, 1].map((k) => (
        <TrailGhost key={k} k={k} badge={badge} box={box} fly={fly} land={land} placeAt={placeAt} />
      ))}
      <Animated.View style={[box, badgeStyle]}>
        <Animated.View style={[styles.slotGlow, { width: from.width * 1.6, height: from.width * 1.6, left: -from.width * 0.3, top: -from.width * 0.3 }, glowStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="sbFlyGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={accent} stopOpacity={0.75} />
                <Stop offset="0.5" stopColor={accent} stopOpacity={0.2} />
                <Stop offset="1" stopColor={accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill="url(#sbFlyGlow)" />
          </Svg>
        </Animated.View>
        <StreakBadgeImage badge={badge} style={styles.fill} />
      </Animated.View>

      {to && (
        <View style={{ position: 'absolute', left: tx - burst / 2, top: ty - burst / 2, width: burst, height: burst }}>
          <Animated.View style={[StyleSheet.absoluteFill, flashStyle]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id="sbLandFlash" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
                  <Stop offset="0.45" stopColor={accent} stopOpacity={0.5} />
                  <Stop offset="1" stopColor={accent} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={50} cy={50} r={50} fill="url(#sbLandFlash)" />
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, burstStyle]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Circle cx={50} cy={50} r={30} stroke={accent} strokeWidth={2.5} fill="none" />
              <Circle cx={50} cy={50} r={22} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1.2} fill="none" />
            </Svg>
          </Animated.View>
          {LAND_SPARKS.map((a, i) => (
            <LandSpark key={i} angle={a} radius={burst * 0.55} center={burst / 2} accent={accent} land={land} long={i % 2 === 0} />
          ))}
        </View>
      )}
    </View>
  );
};

const LAND_SPARKS = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2 + 0.2);

const TrailGhost: React.FC<{
  k: number;
  badge: StreakBadgeItem;
  box: { position: 'absolute'; left: number; top: number; width: number; height: number };
  fly: SharedValue<number>;
  land: SharedValue<number>;
  placeAt: (f: number) => any;
}> = ({ k, badge, box, fly, land, placeAt }) => {
  const style = useAnimatedStyle(() => {
    const f = Math.max(0, fly.value - k * 0.045);
    const visible = fly.value > 0.02 && land.value === 0;
    return { opacity: visible ? 0.28 / k : 0, transform: placeAt(f) };
  });
  return (
    <Animated.View style={[box, style]}>
      <StreakBadgeImage badge={badge} style={styles.fill} />
    </Animated.View>
  );
};

const LandSpark: React.FC<{ angle: number; radius: number; center: number; accent: string; land: SharedValue<number>; long: boolean }> = ({
  angle,
  radius,
  center,
  accent,
  land,
  long,
}) => {
  const len = long ? 10 : 6;
  const style = useAnimatedStyle(() => {
    const u = land.value;
    const r = radius * (0.25 + cubicOut(u) * 0.75);
    return {
      opacity: u > 0 ? interpolate(u, [0, 0.15, 1], [0, 1, 0], clamp) : 0,
      transform: [
        { translateX: Math.cos(angle) * r },
        { translateY: Math.sin(angle) * r },
        { rotate: `${(angle * 180) / Math.PI + 90}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: center - 1.5, top: center - len / 2, width: 3, height: len, borderRadius: 2, backgroundColor: long ? '#FFFFFF' : accent },
        style,
      ]}
    />
  );
};

// ---------------------------------------------------------------------------

export interface StreakBadgeShowcaseProps {
  /** Index in STREAK_BADGES_DATA of the badge waiting to be opened. */
  currentIndex: number;
  /** Current streak in days, shown in the chip. */
  streakDays: number;
  /** Called after the badge is revealed. */
  onUnlocked?: (badge: StreakBadgeItem) => void;
  /** Called by the button once the badge is open. */
  onContinue?: (badge: StreakBadgeItem) => void;
  continueLabel?: string;
  /**
   * The ✕ button (and Android back); hidden when not given. The earned-badge
   * popup leaves it out, so the badge has to be cracked open to move on.
   */
  onClose?: () => void;
  /**
   * When given, Continue flies the badge to this spot (window coordinates,
   * e.g. its slot on the home screen) and lands it there before onContinue.
   */
  getFlightTarget?: (badge: StreakBadgeItem) => Promise<FlightRect | null>;
  /** Called the moment the flying badge lands. */
  onLanded?: (badge: StreakBadgeItem) => void;
  /**
   * When given, the popup opens with the badge flying from this spot (window
   * coordinates, e.g. its home slot) to the center, where the seal locks over
   * it before the vault fades in. Opens straight away if it can't be found.
   */
  getIntroSource?: (badge: StreakBadgeItem) => Promise<FlightRect | null>;
  sound?: boolean;
  haptics?: boolean;
}

export const StreakBadgeShowcase: React.FC<StreakBadgeShowcaseProps> = ({
  currentIndex,
  streakDays,
  onUnlocked,
  onContinue,
  continueLabel = 'Continue',
  onClose,
  getFlightTarget,
  onLanded,
  getIntroSource,
  sound = true,
  haptics = true,
}) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [stageHeight, setStageHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(110);
  const [headerMeasured, setHeaderMeasured] = useState(false);
  const [taps, setTaps] = useState(0);
  const [unlockedAt, setUnlockedAt] = useState<Date | null>(null);

  // The badge in focus; swiping browses the others without changing which
  // one is current.
  const [viewIndex, setViewIndex] = useState(currentIndex);
  const badge = STREAK_BADGES_DATA[viewIndex];
  const accent = BADGE_ACCENT[badge.id] || ORANGE;
  const copy = BADGE_COPY[badge.id];
  const opened = unlockedAt !== null;
  const viewingCurrent = viewIndex === currentIndex;
  const viewState: SlotState =
    viewIndex < currentIndex || (viewingCurrent && opened) ? 'unlocked' : viewingCurrent ? 'current' : 'locked';
  const size = Math.min(260, width * 0.6);

  const crackSound = useAudioPlayer(require('../../../assets/sounds/badge_crack.mp3'));
  const revealSound = useAudioPlayer(require('../../../assets/sounds/badge_reveal.mp3'));

  const pos = useSharedValue(currentIndex);
  const ember = useSharedValue(0);
  const shake = useSharedValue(0);
  const crack = useSharedValue(0);
  const shatter = useSharedValue(0);
  const prompt = useSharedValue(0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => { });
    ember.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    prompt.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [ember, prompt]);

  useEffect(() => {
    pos.value = withTiming(viewIndex, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [viewIndex, pos]);

  // A new current badge (e.g. the test page moving on): bring it into focus
  // and reset the seal.
  useEffect(() => {
    setViewIndex(currentIndex);
    crack.value = 0;
    shatter.value = 0;
    setTaps(0);
    setUnlockedAt(null);
  }, [currentIndex, crack, shatter]);

  const play = (player: ReturnType<typeof useAudioPlayer>) => {
    if (!sound) return;
    const blocked =
      Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === false;
    if (blocked) return;
    try {
      player.seekTo(0).catch(() => { });
      player.play();
    } catch (err) {
      console.warn('Could not play badge sound:', err);
    }
  };

  const buzz = (kind: 'medium' | 'heavy' | 'success') => {
    if (!haptics || Platform.OS === 'web') return;
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
  };

  // Continue: the scene fades away and the badge flies to its spot.
  const rootRef = useRef<View>(null);
  const [leaving, setLeaving] = useState(false);
  const [flight, setFlight] = useState<{ from: FlightRect; to: FlightRect | null } | null>(null);
  // Hidden while the opening flight plays.
  const sceneFade = useSharedValue(getIntroSource ? 0 : 1);
  const lift = useSharedValue(0);
  const fly = useSharedValue(0);
  const land = useSharedValue(0);
  const sceneStyle = useAnimatedStyle(() => ({ opacity: sceneFade.value }));

  const finishFlight = () => onContinue?.(badge);
  const impact = () => {
    buzz('success');
    onLanded?.(badge);
    land.value = withTiming(1, { duration: LAND_MS, easing: Easing.out(Easing.quad) }, (done) => {
      if (done) runOnJS(finishFlight)();
    });
  };

  const handleContinue = async () => {
    if (!getFlightTarget) {
      onContinue?.(badge);
      return;
    }
    if (leaving) return;
    setLeaving(true);
    const origin = await measureInWindow(rootRef.current);
    const ox = origin?.x ?? 0;
    const oy = origin?.y ?? 0;
    const from = { x: ox + width / 2 - size / 2, y: oy + stageTop, width: size, height: size };
    setFlight({ from, to: null });
    sceneFade.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) });
    lift.value = withTiming(1, { duration: 280, easing: cubicOut });

    const to = await Promise.race([
      getFlightTarget(badge).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (!to) {
      finishFlight();
      return;
    }
    setFlight({ from, to });
    fly.value = withTiming(1, { duration: FLY_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) runOnJS(impact)();
    });
  };

  const finishReveal = () => {
    const now = new Date();
    setUnlockedAt(now);
    onUnlocked?.(badge);
  };

  const tapStone = () => {
    if (!viewingCurrent || opened || taps >= TAPS_TO_OPEN) return;
    const next = taps + 1;
    setTaps(next);
    if (next < TAPS_TO_OPEN) {
      const amp = next === 1 ? 6 : 10;
      shake.value = withSequence(
        ...[amp, -amp, amp * 0.8, -amp * 0.8, amp * 0.5, -amp * 0.4, 0].map((v) => withTiming(v, { duration: 45 }))
      );
      crack.value = withTiming(next / (TAPS_TO_OPEN - 1), { duration: 260, easing: cubicOut });
      play(crackSound);
      buzz(next === 1 ? 'medium' : 'heavy');
    } else {
      shatter.value = withTiming(1, { duration: 1400, easing: Easing.linear }, (done) => {
        if (done) runOnJS(finishReveal)();
      });
      play(revealSound);
      buzz('success');
    }
  };

  const tapAgainStyle = useAnimatedStyle(() => ({ opacity: 0.55 + prompt.value * 0.45 }));

  const textSwap = useSharedValue(0);
  useEffect(() => {
    textSwap.value = 0;
    textSwap.value = withTiming(1, { duration: 450, easing: cubicOut });
  }, [opened, currentIndex, viewIndex, textSwap]);
  const textStyle = useAnimatedStyle(() => ({ opacity: textSwap.value, transform: [{ translateY: (1 - textSwap.value) * 8 }] }));

  const slots = useMemo(
    () =>
      STREAK_BADGES_DATA.map((_, i) => ({
        idx: i,
        state: (i < currentIndex ? 'unlocked' : i === currentIndex ? 'current' : 'locked') as SlotState,
      })),
    [currentIndex]
  );

  // Swipe left/right to browse. Locked while the stone is shattering.
  const last = STREAK_BADGES_DATA.length - 1;
  const spacing = width / 2 + size * 0.12;
  const dragStart = useSharedValue(0);
  const shattering = taps >= TAPS_TO_OPEN && !opened;
  // Browsing waits for the opening flight (state for it is declared below).
  const introFinishedRef = useRef(!getIntroSource);
  const pan = Gesture.Pan()
    .enabled(!shattering && !(getIntroSource && !introFinishedRef.current))
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onStart(() => {
      dragStart.value = pos.value;
    })
    .onUpdate((e) => {
      const p = dragStart.value - e.translationX / spacing;
      pos.value = Math.min(last + 0.25, Math.max(-0.25, p));
    })
    .onEnd((e) => {
      const from = Math.round(dragStart.value);
      const projected = pos.value - (e.velocityX / spacing) * 0.12;
      const target = Math.min(last, Math.max(0, Math.min(from + 1, Math.max(from - 1, Math.round(projected)))));
      pos.value = withTiming(target, { duration: 380, easing: Easing.out(Easing.cubic) });
      runOnJS(setViewIndex)(target);
    });

  // Layout: the copy, the badge and the "TAP" prompt form one block, centered
  // between the ✕ row and the button (like the reward screens).
  const headerTop = insets.top + HEADER_TOP;
  const buttonGap = Math.max(insets.bottom + 16, BUTTON_BOTTOM_GAP);
  const areaTop = headerTop + headerHeight + BLOCK_GAP;
  const areaBottom = stageHeight - buttonGap - BUTTON_HEIGHT - BLOCK_GAP;
  const blockHeight = size * (1 + PROMPT_SPACE);
  const stageTop = areaTop + Math.max(0, (areaBottom - areaTop - blockHeight) / 2);

  // Tapping a side badge brings it to the center.
  const step = (dir: number) => setViewIndex((v) => Math.min(last, Math.max(0, v + dir)));
  const rowTop = stageTop;
  const sideTap = Gesture.Tap()
    .enabled(!shattering && !(getIntroSource && !introFinishedRef.current))
    .maxDistance(10)
    .onEnd((e, success) => {
      if (!success || e.y < rowTop || e.y > rowTop + size) return;
      if (e.x < width * 0.2) runOnJS(step)(-1);
      else if (e.x > width * 0.8) runOnJS(step)(1);
    });
  const browse = Gesture.Race(pan, sideTap);

  // Where the badge rests: the image is scaled to the screen width and
  // shifted so its plinth lines up with the bottom of the center badge.
  const restY = stageTop + size * 0.8;
  const bgW = Math.max(width, 1);
  const bgH = (bgW * VAULT_BG_H) / VAULT_BG_W;
  const bgTop = restY - (bgW * VAULT_BG_PLINTH_Y) / VAULT_BG_W;
  // Opening flight (see IntroFlight). Waits for the layout so the center
  // slot's position is final, then for the home slot to be found.
  const [intro, setIntro] = useState<'pending' | 'playing' | 'done'>(getIntroSource ? 'pending' : 'done');
  const [introRects, setIntroRects] = useState<{ from: FlightRect; to: FlightRect } | null>(null);
  const introDim = useSharedValue(0);
  const introFly = useSharedValue(0);
  const introSeal = useSharedValue(0);
  const introReveal = useSharedValue(0);
  const introStarted = useRef(false);

  const showScene = () => {
    sceneFade.value = withTiming(1, { duration: INTRO_REVEAL_MS, easing: Easing.out(Easing.quad) });
  };
  const finishIntro = () => {
    introFinishedRef.current = true;
    setIntro('done');
  };
  const introSealed = () => {
    showScene();
    introReveal.value = withTiming(1, { duration: INTRO_REVEAL_MS, easing: Easing.out(Easing.quad) }, (done) => {
      if (done) runOnJS(finishIntro)();
    });
  };
  const introArrived = () => {
    buzz('heavy');
    play(crackSound);
    introSeal.value = withTiming(1, { duration: INTRO_SEAL_MS, easing: Easing.out(Easing.quad) }, (done) => {
      if (done) runOnJS(introSealed)();
    });
  };

  useEffect(() => {
    if (intro !== 'pending' || !getIntroSource || stageHeight === 0 || !headerMeasured || introStarted.current) return;
    introStarted.current = true;
    let cancelled = false;
    (async () => {
      const origin = await measureInWindow(rootRef.current);
      const to = { x: (origin?.x ?? 0) + width / 2 - size / 2, y: (origin?.y ?? 0) + stageTop, width: size, height: size };
      const from = await Promise.race([
        getIntroSource(STREAK_BADGES_DATA[currentIndex]).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), INTRO_SOURCE_TIMEOUT_MS)),
      ]);
      if (cancelled) return;
      if (!from) {
        // Home slot not found: open the vault without the flight.
        showScene();
        finishIntro();
        return;
      }
      setIntroRects({ from, to });
      setIntro('playing');
      introDim.value = withTiming(1, { duration: 280 });
      introFly.value = withDelay(
        140,
        withTiming(1, { duration: INTRO_FLY_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
          if (done) runOnJS(introArrived)();
        })
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the layout is ready
  }, [intro, stageHeight, headerMeasured]);

  const introDone = intro === 'done';
  const showTapPrompt = introDone && viewingCurrent && !opened && taps < TAPS_TO_OPEN;

  return (
    <GestureDetector gesture={browse}>
      <View ref={rootRef} style={styles.root} onLayout={(e) => setStageHeight(e.nativeEvent.layout.height)}>
        <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]} pointerEvents={leaving ? 'none' : 'box-none'}>
        {/* Stage (behind the copy and buttons) */}
        <View style={styles.stage} pointerEvents="box-none">
          {stageHeight > 0 && (
            <>
              <Image source={VAULT_BG} style={{ position: 'absolute', left: 0, top: bgTop, width: bgW, height: bgH }} />

              {/* Spotlight and the badge's shadow on the podium */}
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <RadialGradient id="sbSpot" cx="50%" cy="47%" r="60%">
                    <Stop offset="0" stopColor={accent} stopOpacity={opened ? 0.22 : 0.1} />
                    <Stop offset="0.5" stopColor={ORANGE} stopOpacity={0.05} />
                    <Stop offset="1" stopColor="#000000" stopOpacity={0} />
                  </RadialGradient>
                  <LinearGradient id="sbTopFade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={VAULT_BG_COLOR} stopOpacity={1} />
                    <Stop offset="1" stopColor={VAULT_BG_COLOR} stopOpacity={0} />
                  </LinearGradient>
                  <RadialGradient id="sbShadow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#000000" stopOpacity={0.85} />
                    <Stop offset="1" stopColor="#000000" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={width / 2} cy={stageTop + size / 2} rx={width * 0.8} ry={stageHeight * 0.45} fill="url(#sbSpot)" />
                <Ellipse cx={width / 2} cy={restY} rx={size * 0.3} ry={size * 0.05} fill="url(#sbShadow)" />
                {/* Blend the image's top edge into the page */}
                <Rect x={0} y={Math.max(0, bgTop)} width={width} height={TOP_FADE} fill="url(#sbTopFade)" />
              </Svg>
              {EMBERS.map((e, i) => (
                <Ember key={i} ember={e} width={width} height={stageHeight} clock={ember} />
              ))}

              <View style={[styles.row, { top: stageTop, height: size }]}>
                {slots.map(({ idx, state }) => (
                  <BadgeSlot
                    key={STREAK_BADGES_DATA[idx].id}
                    badge={STREAK_BADGES_DATA[idx]}
                    pos={pos}
                    offset={idx}
                    state={state}
                    size={size}
                    stageWidth={width}
                    shake={shake}
                    crack={crack}
                    shatter={shatter}
                  />
                ))}
              </View>

              {/* Tap target over the center badge */}
              {introDone && viewingCurrent && !opened && (
                <Pressable
                  style={{ position: 'absolute', left: width / 2 - size / 2, top: stageTop, width: size, height: size }}
                  onPress={tapStone}
                  accessibilityRole="button"
                  accessibilityLabel="Tap to crack"
                />
              )}

              {showTapPrompt && (
                <Animated.Text style={[styles.tapAgain, { top: stageTop + size * 1.16 }, tapAgainStyle]}>
                  {taps === 0 ? 'TAP TO CRACK' : 'TAP AGAIN'}
                </Animated.Text>
              )}
            </>
          )}
        </View>

        {/* Top copy */}
        <Animated.View
          style={[styles.header, { top: headerTop }, textStyle]}
          pointerEvents="none"
          onLayout={(e) => {
            setHeaderHeight(e.nativeEvent.layout.height);
            setHeaderMeasured(true);
          }}
        >
          <Text style={styles.title}>{badge.title}</Text>
          <Text style={styles.subtitle}>{viewState === 'unlocked' ? copy.unlocked : copy.sealed}</Text>
          <View style={[styles.chip, { borderColor: `${accent}55` }]}>
            <Ionicons name="flame" size={13} color={ORANGE} />
            <Text style={styles.chipText}>
              {badge.daysText} milestone · {streakDays}-day streak
            </Text>
          </View>
        </Animated.View>

        {/* Bottom */}
        <View style={[styles.footer, { paddingBottom: buttonGap }]}>
          {viewingCurrent && opened && (
            <Animated.View style={[styles.footerInner, textStyle]}>
              <Pressable style={styles.button} onPress={handleContinue} accessibilityRole="button">
                <Text style={styles.buttonText}>{continueLabel}</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>

        {onClose && (
          <Pressable
            style={[styles.closeBtn, { top: insets.top + 6 }]}
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        )}
        </Animated.View>

        {intro === 'playing' && introRects && (
          <IntroFlight
            badge={STREAK_BADGES_DATA[currentIndex]}
            accent={BADGE_ACCENT[STREAK_BADGES_DATA[currentIndex].id] || ORANGE}
            from={introRects.from}
            to={introRects.to}
            dim={introDim}
            fly={introFly}
            seal={introSeal}
            reveal={introReveal}
          />
        )}

        {flight && (
          <FlyingBadge badge={badge} accent={accent} from={flight.from} to={flight.to} lift={lift} fly={fly} land={land} />
        )}
      </View>
    </GestureDetector>
  );
};

export interface StreakBadgeShowcaseModalProps extends StreakBadgeShowcaseProps {
  visible: boolean;
}

const ignoreBack = () => {};

/**
 * Popup version: fades in over the current screen and starts fresh each time
 * it opens. Android's back button calls `onClose`, and does nothing when
 * there's no ✕ (the badge has to be opened and continued).
 */
export const StreakBadgeShowcaseModal: React.FC<StreakBadgeShowcaseModalProps> = ({ visible, ...props }) => (
  <Modal visible={visible} animationType="fade" transparent={true} statusBarTranslucent={true} onRequestClose={props.onClose ?? ignoreBack}>
    {/* Gestures inside a Modal need their own root on Android */}
    <GestureHandlerRootView style={styles.modalRoot}>
      <StreakBadgeShowcase {...props} />
    </GestureHandlerRootView>
  </Modal>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  modalRoot: {
    flex: 1,
  },
  introDim: {
    backgroundColor: '#000000',
  },
  closeBtn: {
    position: 'absolute',
    left: 12,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    lineHeight: 30,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  chip: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  chipText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    color: '#E5E7EB',
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: VAULT_BG_COLOR,
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  slot: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  slotGlow: {
    position: 'absolute',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  lockWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 10, 12, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tapAgain: {
    position: 'absolute',
    color: '#FFFFFF',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    letterSpacing: 2,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 132,
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'flex-end',
  },
  footerInner: {
    alignItems: 'center',
  },
  // Same as the reward screens' "Got it!" button.
  button: {
    alignSelf: 'stretch',
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  buttonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 17,
    letterSpacing: -0.43,
    color: '#0D0F12',
  },
});
