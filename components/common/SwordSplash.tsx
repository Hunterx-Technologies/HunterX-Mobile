import React, { useEffect, useRef, useState } from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';

// The launch animation, shown once on a cold start over the app as it loads.
// The empty glass tile appears with a glint, the X's blue-and-gold stroke slashes in from the
// top left, then the sword plunges in from the top right and locks across it
// with a flash and a small shake. From there it matches
// AnimatedSplash: the "HunterX" wordmark slides out, a sheen passes over the
// logo and it fades into the app (about 2.9s).
//
// The pieces are cut from app_logo.png (assets/images/splash) on the same
// 1024 canvas, so once they land they line up exactly; the real logo then
// crossfades in under the flash.

const LOGO = require('../../assets/images/app_logo.png');
const TILE = require('../../assets/images/splash/logo_tile.jpg');
const STROKE = require('../../assets/images/splash/logo_stroke.png');
const SWORD = require('../../assets/images/splash/logo_sword.png');

// The logo PNG is a rounded square on a black canvas (about 66–957 px of
// 1024). It is drawn slightly larger than its clip so only the square shows.
const LOGO_INSET = 72 / 1024;
const LOGO_SCALE = 1 / (1 - 2 * LOGO_INSET);
const LOGO_RADIUS = 0.21;

// Directions on the logo canvas (unit vectors, y down).
const STROKE_DIR = { x: 0.569, y: 0.822 }; // the X stroke, top left → bottom right
const SWORD_DIR = { x: -0.686, y: 0.728 }; // the sword, pommel → tip (top right → bottom left)

const GOLD = '#F6B23C';
const GOLD_SOFT = '#FFD98A';

// Timeline (ms).
const TILE_AT = 150;
const GLINT_AT = 260;
const GLINT_MS = 520;
const STROKE_AT = 420;
const STROKE_MS = 320;
const SWORD_AT = 640;
const SWORD_MS = 300;
const CLASH_AT = SWORD_AT + SWORD_MS;
const SHIFT_AT = 1400;
const SHIFT_MS = 560;
const SHEEN_AT = 1900;
const SHEEN_MS = 750;
const EXIT_AT = 2550;
const EXIT_MS = 380;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

function Glow({ size, color, id }: { size: number; color: string; id: string }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="0.35" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * One flying piece of the logo. `progress` runs 0 → 1 as it travels in along
 * `dir` (arriving from `-dir * distance`) and turns from `spin` degrees to 0.
 * A trailing ghost (`lag` behind) reads as motion blur while it moves.
 */
function FlyingPiece({
  source,
  size,
  offset,
  dir,
  distance,
  spin,
  progress,
  visible,
  lag = 0,
  ghost = 1,
}: {
  source: ImageSourcePropType;
  size: number;
  offset: number;
  dir: { x: number; y: number };
  distance: number;
  spin: number;
  progress: SharedValue<number>;
  visible: SharedValue<number>;
  lag?: number;
  ghost?: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = clamp01(progress.value - lag);
    const away = 1 - p;
    const moving = progress.value > 0 && progress.value < 1;
    return {
      opacity: progress.value <= 0 ? 0 : (lag > 0 ? (moving ? ghost * away : 0) : 1) * visible.value,
      transform: [
        { translateX: -dir.x * distance * away },
        { translateY: -dir.y * distance * away },
        { rotate: `${spin * away}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', width: size, height: size, left: offset, top: offset }, style]}
      pointerEvents="none"
    >
      <Image source={source} style={{ width: size, height: size }} resizeMode="cover" />
    </Animated.View>
  );
}

export function SwordSplash({ onFinish }: { onFinish: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const L = clamp(Math.min(width, height) * 0.24, 72, 132); // logo size
  const fontSize = Math.round(L * 0.44);
  const gap = Math.round(L * 0.2);
  const wordFont = { fontSize, letterSpacing: fontSize * 0.01 };
  // The full 1024 canvas, positioned so its rounded square fills the L box.
  const canvas = L * LOGO_SCALE;
  const canvasOffset = -L * LOGO_INSET * LOGO_SCALE;
  // A layer of the given size centred on the logo, positioned explicitly so
  // layers larger than the logo are never clipped or shifted by flex layout.
  const onLogo = (w: number, h: number = w) => ({
    position: 'absolute' as const,
    width: w,
    height: h,
    left: (L - w) / 2,
    top: (L - h) / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });

  const [textW, setTextW] = useState(0);
  const textWidth = useSharedValue(0);

  const tileIn = useSharedValue(0);
  const stroke = useSharedValue(0);
  const sword = useSharedValue(0);
  const pieces = useSharedValue(1); // fades the cut pieces once the real logo is in
  const logoIn = useSharedValue(0); // the real logo, crossfaded in at the clash
  const flash = useSharedValue(0);
  const shake = useSharedValue(0);
  const shift = useSharedValue(0);
  const sheen = useSharedValue(0);
  const glint = useSharedValue(0);
  const exit = useSharedValue(0);

  const finished = useRef(false);

  useEffect(() => {
    textWidth.value = textW;
  }, [textW, textWidth]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      onFinish();
    };

    if (reduceMotion) {
      // Just the finished lockup, faded in and out.
      tileIn.value = 1;
      logoIn.value = withTiming(1, { duration: 300 });
      pieces.value = 0;
      shift.value = 1;
      exit.value = withDelay(1100, withTiming(1, { duration: 300 }));
      timers.push(setTimeout(finish, 1400));
      return () => timers.forEach(clearTimeout);
    }

    const out = Easing.out(Easing.cubic);
    tileIn.value = withDelay(TILE_AT, withSpring(1, { damping: 15, stiffness: 160 }));
    glint.value = withDelay(GLINT_AT, withTiming(1, { duration: GLINT_MS, easing: Easing.inOut(Easing.quad) }));
    stroke.value = withDelay(STROKE_AT, withTiming(1, { duration: STROKE_MS, easing: out }));
    sword.value = withDelay(SWORD_AT, withTiming(1, { duration: SWORD_MS, easing: Easing.in(Easing.quad) }));

    flash.value = withDelay(CLASH_AT, withTiming(1, { duration: 480, easing: out }));
    shake.value = withDelay(
      CLASH_AT,
      withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(-0.8, { duration: 50 }),
        withTiming(0.5, { duration: 50 }),
        withTiming(-0.25, { duration: 50 }),
        withTiming(0, { duration: 60 })
      )
    );
    logoIn.value = withDelay(CLASH_AT + 60, withTiming(1, { duration: 260 }));
    pieces.value = withDelay(CLASH_AT + 320, withTiming(0, { duration: 1 }));

    shift.value = withDelay(SHIFT_AT, withTiming(1, { duration: SHIFT_MS, easing: Easing.inOut(Easing.cubic) }));
    sheen.value = withDelay(SHEEN_AT, withTiming(1, { duration: SHEEN_MS, easing: Easing.inOut(Easing.quad) }));
    exit.value = withDelay(EXIT_AT, withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.quad) }));
    timers.push(setTimeout(finish, EXIT_AT + EXIT_MS));

    return () => timers.forEach(clearTimeout);
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.04 * exit.value }],
  }));

  const logoBoxStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shake.value * L * 0.035 },
      { translateY: -shake.value * L * 0.02 },
      { scale: 1 + 0.035 * Math.abs(shake.value) },
    ],
  }));

  const tileStyle = useAnimatedStyle(() => ({
    opacity: clamp01(tileIn.value * 1.8) * pieces.value,
    transform: [{ scale: 0.82 + 0.18 * tileIn.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoIn.value }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (0.25 * logoIn.value + 0.5 * (flash.value > 0 ? 1 - flash.value : 0)) * (1 - 0.5 * sheen.value),
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value <= 0 ? 0 : interpolate(flash.value, [0, 0.12, 1], [0.3, 1, 0]),
    transform: [{ scale: 0.25 + 1.3 * flash.value }],
  }));

  const glintStyle = useAnimatedStyle(() => ({
    opacity: glint.value <= 0 || glint.value >= 1 ? 0 : 1,
    transform: [{ translateX: -L * 1.1 + L * 2.4 * glint.value }, { rotate: '22deg' }],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sheen.value <= 0 || sheen.value >= 1 ? 0 : 1,
    transform: [{ translateX: -L * 1.1 + L * 2.4 * sheen.value }, { rotate: '22deg' }],
  }));

  // The wordmark's clip grows from nothing, which also pushes the logo left
  // (the row stays centred) so it appears to slide out from behind it.
  const wordClipStyle = useAnimatedStyle(() => ({
    width: (gap + textWidth.value) * shift.value,
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: clamp01(shift.value * 1.6 - 0.1),
    transform: [{ translateX: -fontSize * 0.6 * (1 - shift.value) }],
  }));

  const strokeProps = {
    source: STROKE,
    size: canvas,
    offset: canvasOffset,
    dir: STROKE_DIR,
    distance: L * 1.7,
    spin: -14,
    progress: stroke,
    visible: pieces,
  };
  const swordProps = {
    source: SWORD,
    size: canvas,
    offset: canvasOffset,
    dir: SWORD_DIR,
    distance: L * 2,
    spin: 18,
    progress: sword,
    visible: pieces,
  };

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <Animated.View style={[styles.row, stageStyle]}>
        <Animated.View style={[{ width: L, height: L }, logoBoxStyle]}>
          <Animated.View style={[onLogo(L * 2.6), haloStyle]} pointerEvents="none">
            <Glow size={L * 2.6} color={GOLD} id="sw-halo" />
          </Animated.View>

          {/* The empty tile the pieces land in. */}
          <Animated.View style={[StyleSheet.absoluteFill, tileStyle]}>
            <View style={[styles.logoClip, { borderRadius: L * LOGO_RADIUS }]}>
              <Image
                source={TILE}
                style={{ position: 'absolute', width: canvas, height: canvas, left: canvasOffset, top: canvasOffset }}
                resizeMode="cover"
              />
              <Animated.View
                style={[styles.sheen, { width: L * 0.3, height: L * 2, top: -L * 0.5 }, glintStyle]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </Animated.View>

          {/* The pieces fly in from outside the tile, so they are not clipped. */}
          <FlyingPiece {...strokeProps} lag={0.14} ghost={0.35} />
          <FlyingPiece {...strokeProps} />
          <FlyingPiece {...swordProps} lag={0.2} ghost={0.25} />
          <FlyingPiece {...swordProps} lag={0.1} ghost={0.4} />
          <FlyingPiece {...swordProps} />

          {/* The real logo, swapped in under the flash. */}
          <Animated.View style={[StyleSheet.absoluteFill, logoStyle]}>
            <View style={[styles.logoClip, { borderRadius: L * LOGO_RADIUS }]}>
              <Image
                source={LOGO}
                style={{ position: 'absolute', width: canvas, height: canvas, left: canvasOffset, top: canvasOffset }}
                resizeMode="cover"
              />
              <Animated.View
                style={[styles.sheen, { width: L * 0.38, height: L * 2, top: -L * 0.5 }, sheenStyle]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </Animated.View>

          {/* Clash: flash where the sword crosses the X. */}
          <Animated.View style={[onLogo(L * 1.7), flashStyle]} pointerEvents="none">
            <Glow size={L * 1.7} color={GOLD_SOFT} id="sw-flash" />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.wordClip, { height: fontSize * 1.4 }, wordClipStyle]}>
          <Animated.View style={[styles.wordInner, { left: gap, width: textW || fontSize * 6 }, wordStyle]}>
            <Text style={[styles.word, wordFont]} numberOfLines={1}>
              Hunter<Text style={styles.wordX}>X</Text>
            </Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* Invisible copy, laid out freely, to measure the wordmark's width. */}
      <View style={styles.measure} pointerEvents="none">
        <Text
          style={[styles.word, wordFont]}
          onLayout={(e) => setTextW(Math.ceil(e.nativeEvent.layout.width) + 2)}
        >
          Hunter<Text style={styles.wordX}>X</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    // The pieces start off-screen; clip them so the page never scrolls.
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoClip: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0B0F18',
  },
  sheen: {
    position: 'absolute',
    left: 0,
  },
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 2000,
    flexDirection: 'row',
    opacity: 0,
  },
  wordClip: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  wordInner: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  word: {
    fontFamily: 'Inter_700Bold',
    color: '#F4F5F6',
  },
  wordX: {
    color: GOLD,
  },
});
