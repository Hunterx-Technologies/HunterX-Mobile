import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Canvas,
  Group,
  Image as SkImage,
  LinearGradient as SkGradient,
  Path as SkPath,
  Rect as SkRect,
  Skia,
  Text as SkText,
  matchFont,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import Svg, {
  Defs,
  G,
  Image as SvgImage,
  LinearGradient as SvgGradient,
  Mask,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { fontFamilies } from '@/theme/typography';

const HUNTERX_TITLE = require('../../../assets/images/hunterx_card_title.png');

const AnimatedPath = Animated.createAnimatedComponent(Path);

const ORANGE = '#FE5B01';
const RADIUS = 16;
// One full loop: finger lands, scratches, prize pops, holds, card resets.
const CYCLE_MS = 4200;
// Phases of the loop, as fractions of CYCLE_MS.
const SCRATCH_START = 0.08;
const SCRATCH_END = 0.5;
const REVEAL_END = 0.6;
const RESET_START = 0.9;

// The finger's zigzag over the foil, as fractions of the card's size.
const ZIGZAG = [
  [0.14, 0.26],
  [0.86, 0.3],
  [0.16, 0.52],
  [0.84, 0.56],
  [0.18, 0.78],
  [0.86, 0.8],
];

// Built once here; worklets below capture them.
const SCRATCH_EASE = Easing.inOut(Easing.quad);
const POP_EASE = Easing.out(Easing.back(2.2));

const clamp01 = (v: number) => {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
};

/**
 * The app tour's reward teaser: a small HunterX scratch card that a finger
 * scratches open on a loop, popping a prize out from under the foil. Display
 * only (the tour swallows touches). With reduced motion it shows the prize.
 */
export function TutorialScratchDemo({ width, height = 150 }: { width: number; height?: number }) {
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(reduceMotion ? REVEAL_END : 0);

  useEffect(() => {
    if (reduceMotion) return;
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [clock, reduceMotion]);

  // The zigzag in pixels, its SVG path and the running length at each point.
  const { xs, ys, cum, total, d } = useMemo(() => {
    const px = ZIGZAG.map(([fx]) => fx * width);
    const py = ZIGZAG.map(([, fy]) => fy * height);
    const run = [0];
    for (let i = 1; i < px.length; i++) {
      run.push(run[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]));
    }
    const path = px.map((x, i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${py[i].toFixed(1)}`).join(' ');
    return { xs: px, ys: py, cum: run, total: run[run.length - 1], d: path };
  }, [width, height]);

  // How much of the zigzag has been scratched, 0..1.
  const scratched = useDerivedValue(() => {
    const t = clock.value;
    return t >= RESET_START ? 0 : SCRATCH_EASE(clamp01((t - SCRATCH_START) / (SCRATCH_END - SCRATCH_START)));
  });

  // The foil fades once mostly scratched, and comes back for the next loop.
  const foilStyle = useAnimatedStyle(() => {
    const t = clock.value;
    if (t >= RESET_START) return { opacity: clamp01((t - RESET_START) / 0.06) };
    return { opacity: 1 - clamp01((t - SCRATCH_END) / (REVEAL_END - SCRATCH_END)) };
  });

  // The prize pops in as the foil goes, and fades before the reset.
  const prizeStyle = useAnimatedStyle(() => {
    const t = clock.value;
    const pop = clamp01((t - SCRATCH_END + 0.04) / (REVEAL_END - SCRATCH_END + 0.04));
    const out = t >= RESET_START ? clamp01((t - RESET_START) / 0.05) : 0;
    return {
      opacity: (1 - out) * (0.35 + pop * 0.65),
      transform: [{ scale: 0.86 + POP_EASE(pop) * 0.14 }],
    };
  });

  // Glow burst behind the prize at the moment it's revealed.
  const burstStyle = useAnimatedStyle(() => {
    const t = clock.value;
    const b = clamp01((t - SCRATCH_END) / 0.18);
    return {
      opacity: t >= RESET_START ? 0 : b < 0.3 ? b / 0.3 : 1 - (b - 0.3) / 0.7,
      transform: [{ scale: 0.6 + b * 0.9 }],
    };
  });

  // The finger rides the zigzag, pressing in while scratching.
  const fingerStyle = useAnimatedStyle(() => {
    const t = clock.value;
    const p = clamp01((t - SCRATCH_START) / (SCRATCH_END - SCRATCH_START));
    const dist = total * SCRATCH_EASE(p);
    let x = xs[0];
    let y = ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (dist <= cum[i] || i === xs.length - 1) {
        const seg = cum[i] - cum[i - 1];
        const f = seg > 0 ? clamp01((dist - cum[i - 1]) / seg) : 0;
        x = xs[i - 1] + (xs[i] - xs[i - 1]) * f;
        y = ys[i - 1] + (ys[i] - ys[i - 1]) * f;
        break;
      }
    }
    const appear = clamp01(t / SCRATCH_START);
    const leave = clamp01((t - SCRATCH_END) / 0.06);
    const pressing = t > SCRATCH_START && t < SCRATCH_END;
    return {
      opacity: t >= RESET_START ? 0 : appear * (1 - leave),
      transform: [
        // The fingertip (top centre of the 30px icon) sits on the scratch point.
        { translateX: x - 15 },
        { translateY: y - 2 },
        { scale: pressing ? 0.92 : 1 },
      ],
    };
  });

  return (
    <View style={[styles.frame, { width, height }]} accessible accessibilityLabel="A scratch card being scratched to reveal a reward">
      {/* Prize under the foil */}
      <LinearGradient
        colors={['#1D130C', '#121316', '#0E0F12']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View pointerEvents="none" style={[styles.burst, { left: width / 2 - 70, top: height / 2 - 70 }, burstStyle]} />
      <Animated.View style={[styles.prize, prizeStyle]}>
        <LinearGradient
          colors={['#FF7A2F', ORANGE, '#B83E00']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.prizeIcon}
        >
          <Ionicons name="gift" size={22} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.prizeText}>
          <Text style={styles.prizeEyebrow}>YOU WON</Text>
          <Text style={styles.prizeTitle} numberOfLines={1}>
            Exclusive reward
          </Text>
          <Text style={styles.prizeSub} numberOfLines={1}>
            Vouchers, gear & more
          </Text>
        </View>
      </Animated.View>

      {/* Foil, scratched away along the finger's path */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, foilStyle]}>
        {Platform.OS === 'web' ? (
          <SvgFoil width={width} height={height} d={d} total={total} scratched={scratched} />
        ) : (
          <SkiaFoil width={width} height={height} d={d} scratched={scratched} />
        )}
      </Animated.View>

      {/* Finger */}
      <Animated.View pointerEvents="none" style={[styles.finger, fingerStyle]}>
        <MaterialCommunityIcons name="hand-pointing-up" size={30} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

type FoilProps = { width: number; height: number; d: string; scratched: SharedValue<number> };

const scratchWidth = (height: number) => Math.round(height * 0.3);
const titleSize = (width: number) => {
  const w = Math.round(width * 0.42);
  return { w, h: Math.round(w / 3.3) };
};
const curves = (width: number, height: number) => [
  `M -10 ${height * 0.35} C ${width * 0.3} ${height * 0.2}, ${width * 0.6} ${height * 0.6}, ${width + 10} ${height * 0.4}`,
  `M -10 ${height * 0.7} C ${width * 0.35} ${height * 0.55}, ${width * 0.65} ${height * 0.95}, ${width + 10} ${height * 0.75}`,
];
const LABEL = 'SCRATCH TO REVEAL';

/**
 * Phones: the foil is drawn by Skia on the GPU and the scratch is a trimmed
 * stroke that clears it, so each frame is cheap even on low-end Android (an
 * SVG mask re-rasterised every frame is not).
 */
function SkiaFoil({ width, height, d, scratched }: FoilProps) {
  const title = useImage(HUNTERX_TITLE);
  const scratchPath = useMemo(() => Skia.Path.MakeFromSVGString(d), [d]);
  const lines = useMemo(() => curves(width, height).map((c) => Skia.Path.MakeFromSVGString(c)), [width, height]);
  const font = useMemo(
    () => matchFont({ fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }), fontSize: 8, fontWeight: '600' }),
    []
  );
  const { w: tw, h: th } = titleSize(width);
  const labelWidth = font.measureText(LABEL).width;

  return (
    <Canvas style={{ width, height }}>
      {/* Its own layer, so the scratch clears the foil and not what's under it */}
      <Group layer>
        <SkRect x={0} y={0} width={width} height={height}>
          <SkGradient start={vec(0, 0)} end={vec(width, height)} colors={['#1B1D22', '#141518', '#0E0F12']} positions={[0, 0.55, 1]} />
        </SkRect>
        <SkRect x={0} y={0} width={width} height={height}>
          <SkGradient start={vec(0, 0)} end={vec(width * 0.6, height * 0.6)} colors={['rgba(254,91,1,0.16)', 'rgba(254,91,1,0)']} />
        </SkRect>
        {lines[0] ? <SkPath path={lines[0]} style="stroke" strokeWidth={1} color="#2A2C33" /> : null}
        {lines[1] ? <SkPath path={lines[1]} style="stroke" strokeWidth={1} color="#24262C" /> : null}
        {title ? <SkImage image={title} x={(width - tw) / 2} y={height * 0.3} width={tw} height={th} fit="contain" /> : null}
        <SkText x={(width - labelWidth) / 2} y={height * 0.3 + th + 18} text={LABEL} font={font} color="#D4D4D8" />
        {scratchPath ? (
          <SkPath
            path={scratchPath}
            style="stroke"
            strokeWidth={scratchWidth(height)}
            strokeCap="round"
            strokeJoin="round"
            color="#000000"
            blendMode="clear"
            start={0}
            end={scratched}
          />
        ) : null}
      </Group>
    </Canvas>
  );
}

/** Web has no Skia (CanvasKit isn't loaded), so it masks an SVG foil instead. */
function SvgFoil({ width, height, d, total, scratched }: FoilProps & { total: number }) {
  const dashProps = useAnimatedProps(() => ({ strokeDashoffset: total * (1 - scratched.value) }));
  const { w: titleWidth, h: titleHeight } = titleSize(width);
  const [c1, c2] = curves(width, height);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <Mask id="tourScratchMask" x={0} y={0} width={width} height={height} maskUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
          <AnimatedPath
            d={d}
            animatedProps={dashProps}
            stroke="#000000"
            strokeWidth={scratchWidth(height)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${total} ${total}`}
            fill="none"
          />
        </Mask>
        <SvgGradient id="tourFoilBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#1B1D22" />
          <Stop offset="55%" stopColor="#141518" />
          <Stop offset="100%" stopColor="#0E0F12" />
        </SvgGradient>
        <SvgGradient id="tourFoilShine" x1="0%" y1="0%" x2="60%" y2="60%">
          <Stop offset="0%" stopColor={ORANGE} stopOpacity={0.16} />
          <Stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <G mask="url(#tourScratchMask)">
        <Rect x={0} y={0} width={width} height={height} fill="url(#tourFoilBg)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#tourFoilShine)" />
        <Path
          d={c1}
          stroke="#2A2C33"
          strokeWidth={1}
          fill="none"
        />
        <Path
          d={c2}
          stroke="#24262C"
          strokeWidth={1}
          fill="none"
        />
        <SvgImage
          href={HUNTERX_TITLE}
          x={(width - titleWidth) / 2}
          y={height * 0.3}
          width={titleWidth}
          height={titleHeight}
          preserveAspectRatio="xMidYMid meet"
        />
        <SvgText
          x={width / 2}
          y={height * 0.3 + titleHeight + 18}
          fill="#D4D4D8"
          fontSize={8}
          letterSpacing={1.4}
          fontWeight="600"
          textAnchor="middle"
        >
          {LABEL}
        </SvgText>
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(254, 91, 1, 0.85)',
    backgroundColor: '#121316',
    marginBottom: 16,
    alignSelf: 'center',
  },
  burst: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(254, 91, 1, 0.28)',
  },
  prize: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 18,
  },
  prizeIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  prizeText: {
    flexShrink: 1,
  },
  prizeEyebrow: {
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: '#FF8A4C',
  },
  prizeTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 2,
  },
  prizeSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#A1A1AA',
    marginTop: 1,
  },
  finger: {
    position: 'absolute',
    left: 0,
    top: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
});
