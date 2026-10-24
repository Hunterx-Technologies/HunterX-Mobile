import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';

// The launch animation shown once on a cold start, on top of the app while it
// loads underneath. The logo pops in, then slides left as the "HunterX" wordmark slides out from behind
// it, a sheen passes over the logo, and the whole thing fades into the app
// (about 2.2s).
//
// Everything is sized from the shorter screen side, so it fits phones,
// tablets and landscape alike.

const LOGO = require('../../assets/images/app_logo.png');

// The logo PNG is a rounded square on a black canvas: the square spans about
// 66–957 px of 1024. The image is drawn slightly larger than its clip so only
// the square shows.
const LOGO_INSET = 72 / 1024;
const LOGO_SCALE = 1 / (1 - 2 * LOGO_INSET);
const LOGO_RADIUS = 0.21;

const GOLD = '#F6B23C';

// Timeline (ms).
const LOGO_AT = 250;
const SHIFT_AT = 680;
const SHIFT_MS = 560;
const SHEEN_AT = 1180;
const SHEEN_MS = 750;
const EXIT_AT = 1880;
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

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const L = clamp(Math.min(width, height) * 0.24, 72, 132); // logo size
  const fontSize = Math.round(L * 0.44);
  const gap = Math.round(L * 0.2);
  const wordFont = { fontSize, letterSpacing: fontSize * 0.01 };
  // A layer of the given size centred on the logo. Positioned explicitly so
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

  const logoIn = useSharedValue(0);
  const shift = useSharedValue(0);
  const sheen = useSharedValue(0);
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
      logoIn.value = withTiming(1, { duration: 300 });
      shift.value = 1;
      exit.value = withDelay(1100, withTiming(1, { duration: 300 }));
      timers.push(setTimeout(finish, 1400));
      return () => timers.forEach(clearTimeout);
    }

    logoIn.value = withDelay(LOGO_AT, withSpring(1, { damping: 13, stiffness: 170, mass: 0.8 }));
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

  const logoStyle = useAnimatedStyle(() => ({
    opacity: clamp01(logoIn.value * 2.5),
    transform: [{ scale: 0.55 + 0.45 * logoIn.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: clamp01(logoIn.value) * 0.25 * (1 - 0.5 * sheen.value),
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

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <Animated.View style={[styles.row, stageStyle]}>
        <View style={{ width: L, height: L }}>
          {/* Soft halo, then the logo. */}
          <Animated.View style={[onLogo(L * 2.6), haloStyle]} pointerEvents="none">
            <Glow size={L * 2.6} color={GOLD} id="halo" />
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, logoStyle]}>
            <View style={[styles.logoClip, { borderRadius: L * LOGO_RADIUS }]}>
              <Image
                source={LOGO}
                style={{
                  position: 'absolute',
                  width: L * LOGO_SCALE,
                  height: L * LOGO_SCALE,
                  left: -L * LOGO_INSET * LOGO_SCALE,
                  top: -L * LOGO_INSET * LOGO_SCALE,
                }}
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

        </View>

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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centered: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
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
