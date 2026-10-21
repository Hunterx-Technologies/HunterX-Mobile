import React, { useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useFonts } from 'expo-font';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { Poppins_900Black_Italic } from '@expo-google-fonts/poppins/900Black_Italic';

import { DiamondRewardScene } from '../reward/diamond/DiamondRewardScene';

// "Level up!" screen: the reward scene's rays and sparkles behind a HunterX
// level badge. The badge motion follows the "game badge upgrade" Rive file
// (rings closing in, a charge-up, then a burst) in HunterX orange: the old
// level number is knocked out and the new one slams in, with a flash,
// shockwaves, sparks, a sound and a haptic tap. The text then rolls in.
//
// Easiest: call showLevelUp({ level, rankName, tierLabel }) from anywhere
// (see store/useLevelUpStore.ts); <GlobalLevelUp /> in the root layout shows
// it. <LevelUpRewardModal /> and <LevelUpReward /> are there for screens that
// manage it themselves.

const ORANGE = '#F66F28';

// Timeline (ms). The sound's impact lands at IMPACT.
const IMPACT = 900;
const INTRO_END = 2600;

// Longest wait for the sound and fonts before the animation starts without them.
const LOAD_TIMEOUT_MS = 1200;

// Layout in artboard units (402x874, same as the reward scene).
const CENTER_X = 201;
const BADGE_Y = 421;
const BADGE_BOX = 300;

export interface LevelUpRewardProps {
  /** The level just reached. */
  level: number;
  /** Shown before the burst; defaults to `level - 1`. */
  previousLevel?: number;
  eyebrow?: string;
  /** Defaults to "You've Reached Level <level>". */
  title?: string;
  rankName?: string;
  /** Short label in the orange pill next to the rank name; hidden when empty. */
  tierLabel?: string;
  /** Use "\n" for line breaks. */
  description?: string;
  buttonLabel?: string;
  /** The ✕ button. */
  onClose?: () => void;
  /** The bottom button. */
  onPress?: () => void;
  /** Plays the level-up sound. Defaults to true. */
  sound?: boolean;
  /** Vibrates on the band intro and the burst (phones only). Defaults to true. */
  haptics?: boolean;
}

export const LEVEL_UP_DEFAULTS = {
  eyebrow: 'LEVEL UP!',
  rankName: 'Dormant III',
  tierLabel: 'DORMANT',
  description: 'Your power is growing. Keep going,\nHunter.',
  buttonLabel: 'Continue',
};

// ---------------------------------------------------------------------------
// Geometry

function hexPoints(r: number, cx = 0, cy = 0): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function hexPath(r: number, cx = 0, cy = 0): string {
  return hexPoints(r, cx, cy).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ') + ' Z';
}

const STAR_PATH = 'M0,-1 Q0.12,-0.12 1,0 Q0.12,0.12 0,1 Q-0.12,0.12 -1,0 Q-0.12,-0.12 0,-1 Z';

// Text box top for a Poppins line with the given baseline (ascent 1.05em,
// descent 0.35em, centered in the line height).
function textTop(baseline: number, size: number, lineHeight: number) {
  return baseline - lineHeight / 2 - 0.35 * size;
}

// ---------------------------------------------------------------------------
// Animation helpers (all worklets)

const clamp = Extrapolation.CLAMP;
const backOut = Easing.out(Easing.back(1.8));
const cubicOut = Easing.out(Easing.cubic);
const cubicInOut = Easing.inOut(Easing.cubic);

function seg(t: number, a: number, b: number) {
  'worklet';
  return interpolate(t, [a, b], [0, 1], clamp);
}

/** Slide-up fade for a text block that starts at `at` ms. */
function useRollIn(clock: SharedValue<number>, at: number, rise = 14) {
  return useAnimatedStyle(() => {
    const u = cubicOut(seg(clock.value, at, at + 420));
    return { opacity: u, transform: [{ translateY: (1 - u) * rise }] };
  });
}

// ---------------------------------------------------------------------------
// Badge layers

const TUNNEL = Array.from({ length: 9 }, (_, k) => ({
  r: 104 + k * 14,
  rot: k * 7,
  op: 0.55 - k * 0.055,
}));
const TUNNEL_SIZE = 2 * (104 + 8 * 14) + 8;

const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + (i % 2 ? 0.18 : -0.1);
  return { a, dist: 118 + (i % 3) * 26, size: i % 3 === 0 ? 9 : 6, spin: i % 2 ? 160 : -140 };
});

const Spark: React.FC<{ clock: SharedValue<number>; spark: (typeof SPARKS)[number] }> = ({ clock, spark }) => {
  const style = useAnimatedStyle(() => {
    const u = seg(clock.value, IMPACT, IMPACT + 750);
    const d = cubicOut(u) * spark.dist;
    const s = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75;
    return {
      opacity: u > 0 && u < 1 ? 1 : 0,
      transform: [
        { translateX: Math.cos(spark.a) * d },
        { translateY: Math.sin(spark.a) * d },
        { rotate: `${u * spark.spin}deg` },
        { scale: Math.max(0, s) },
      ],
    };
  });
  const box = spark.size * 2;
  return (
    <Animated.View style={[styles.centered, { width: box, height: box, marginLeft: -box / 2, marginTop: -box / 2 }, style]}>
      <Svg width={box} height={box} viewBox="-1 -1 2 2">
        <Path d={STAR_PATH} fill="#FFD2A8" />
      </Svg>
    </Animated.View>
  );
};

const Shockwave: React.FC<{ clock: SharedValue<number>; delay: number }> = ({ clock, delay }) => {
  const style = useAnimatedStyle(() => {
    const u = seg(clock.value, IMPACT + delay, IMPACT + delay + 800);
    return {
      opacity: u > 0 ? (1 - u) * 0.9 : 0,
      transform: [{ scale: 1 + cubicOut(u) * 1.5 }],
    };
  });
  return (
    <Animated.View style={[styles.layer, style]}>
      <Svg width={BADGE_BOX} height={BADGE_BOX} viewBox="-150 -150 300 300">
        <Path d={hexPath(100)} fill="none" stroke="#FFB27A" strokeWidth={2.4} />
      </Svg>
    </Animated.View>
  );
};

const LevelBadge: React.FC<{
  clock: SharedValue<number>;
  idle: SharedValue<number>;
  spin: SharedValue<number>;
  level: number;
  previousLevel: number;
}> = ({ clock, idle, spin, level, previousLevel }) => {
  // Rings: close in from far out while charging, kick out on impact, then
  // turn slowly.
  const tunnelStyle = useAnimatedStyle(() => {
    const t = clock.value;
    const closeIn = cubicOut(seg(t, 0, IMPACT));
    const kick = seg(t, IMPACT, IMPACT + 350);
    const settle = cubicOut(seg(t, IMPACT + 350, IMPACT + 1300));
    const s = 1.9 - 0.9 * closeIn + 0.22 * kick - 0.17 * settle;
    const op = 0.15 + 0.6 * closeIn + 0.25 * kick - 0.3 * settle;
    return { opacity: op, transform: [{ scale: s }, { rotate: `${-20 * (1 - closeIn) + spin.value * 360}deg` }] };
  });

  const glowStyle = useAnimatedStyle(() => {
    const t = clock.value;
    const charge = seg(t, 200, IMPACT);
    const burst = seg(t, IMPACT, IMPACT + 200) - seg(t, IMPACT + 200, IMPACT + 1000) * 0.6;
    const pulse = Math.sin(idle.value * Math.PI * 2) * 0.12 * seg(t, 1800, 2400);
    return { opacity: Math.min(1, 0.25 + 0.4 * charge + 0.35 * burst + pulse), transform: [{ scale: 1 + 0.15 * burst }] };
  });

  // Badge: pops in spinning, shakes while charging, punches on impact, then floats.
  const badgeStyle = useAnimatedStyle(() => {
    const t = clock.value;
    const enter = seg(t, 0, 520);
    const s0 = 0.2 + 0.8 * backOut(enter);
    const punch = seg(t, IMPACT, IMPACT + 110) * 0.16 - cubicOut(seg(t, IMPACT + 110, IMPACT + 420)) * 0.16;
    const shakeAmp = 3.2 * seg(t, 480, IMPACT) * (t < IMPACT ? 1 : 0);
    const float = Math.sin(idle.value * Math.PI * 2) * 4 * seg(t, 1800, 2400);
    return {
      opacity: seg(t, 0, 180),
      transform: [
        { translateX: Math.sin(t * 0.11) * shakeAmp },
        { translateY: float },
        { rotate: `${-28 * (1 - cubicOut(enter))}deg` },
        { scale: s0 + punch },
      ],
    };
  });

  const flashStyle = useAnimatedStyle(() => {
    const t = clock.value;
    return { opacity: 0.9 * seg(t, IMPACT - 30, IMPACT + 40) - 0.9 * seg(t, IMPACT + 40, IMPACT + 420) };
  });

  const oldNumberStyle = useAnimatedStyle(() => {
    const u = cubicOut(seg(clock.value, IMPACT, IMPACT + 260));
    return { opacity: 1 - u, transform: [{ translateY: -46 * u }, { scale: 1 - 0.4 * u }] };
  });

  const newNumberStyle = useAnimatedStyle(() => {
    const u = seg(clock.value, IMPACT, IMPACT + 320);
    return { opacity: seg(clock.value, IMPACT, IMPACT + 80), transform: [{ scale: 2.4 - 1.4 * backOut(u) }] };
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.abs(Math.sin(idle.value * Math.PI * 2)) * 3 * seg(clock.value, 1800, 2400) }],
  }));

  const ringDash = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * -720}deg` }] }));

  const digits = String(level).length;
  const numberSize = digits >= 3 ? 58 : digits === 2 ? 76 : 92;

  return (
    <View style={styles.badgeBox} pointerEvents="none">
      {/* Glow */}
      <Animated.View style={[styles.glow, glowStyle]}>
        <Svg width={440} height={440}>
          <Defs>
            <RadialGradient id="luGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FF7A1A" stopOpacity={0.75} />
              <Stop offset="0.45" stopColor="#F66F28" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#F66F28" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={220} cy={220} r={220} fill="url(#luGlow)" />
        </Svg>
      </Animated.View>

      {/* Ring tunnel */}
      <Animated.View style={[styles.tunnel, tunnelStyle]}>
        <Svg width={TUNNEL_SIZE} height={TUNNEL_SIZE} viewBox={`${-TUNNEL_SIZE / 2} ${-TUNNEL_SIZE / 2} ${TUNNEL_SIZE} ${TUNNEL_SIZE}`}>
          {TUNNEL.map((ring, i) => (
            <G key={i} rotation={ring.rot}>
              <Path d={hexPath(ring.r)} fill="none" stroke={ORANGE} strokeOpacity={ring.op} strokeWidth={1} />
            </G>
          ))}
        </Svg>
      </Animated.View>

      <Shockwave clock={clock} delay={0} />
      <Shockwave clock={clock} delay={140} />

      {/* Badge */}
      <Animated.View style={[styles.layer, badgeStyle]}>
        <Svg width={BADGE_BOX} height={BADGE_BOX} viewBox="-150 -150 300 300" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="luRim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFA061" />
              <Stop offset="0.5" stopColor={ORANGE} />
              <Stop offset="1" stopColor="#A9380B" />
            </LinearGradient>
            <LinearGradient id="luFace" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1A1B20" />
              <Stop offset="1" stopColor="#0B0C0F" />
            </LinearGradient>
          </Defs>
          {/* Dashed outer frame with vertex dots */}
          {hexPoints(118).map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={3.6} fill={ORANGE} />
          ))}
          <Path d={hexPath(118)} fill="none" stroke={ORANGE} strokeOpacity={0.65} strokeWidth={1.6} strokeDasharray="6 6" />
          {/* Rim, dark ring, inner line, face */}
          <Path d={hexPath(100)} fill="url(#luRim)" />
          <Path d={hexPath(92)} fill="#08080A" />
          <Path d={hexPath(87)} fill="none" stroke="#F8A46E" strokeOpacity={0.85} strokeWidth={1.3} />
          <Path d={hexPath(82)} fill="url(#luFace)" />
          {/* Facet lines from the inner face to the rim */}
          {hexPoints(82).map(([x, y], i) => {
            const [ox, oy] = hexPoints(92)[i];
            return <Path key={i} d={`M${x},${y} L${ox},${oy}`} stroke="#F8A46E" strokeOpacity={0.35} strokeWidth={1} />;
          })}
        </Svg>
        {/* Slowly turning dashed circle behind the number */}
        <Animated.View style={[styles.dashCircle, ringDash]}>
          <Svg width={100} height={100}>
            <Circle cx={50} cy={50} r={44} fill="none" stroke={ORANGE} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3 5" />
          </Svg>
        </Animated.View>
        {/* Chevron */}
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <Svg width={30} height={16} viewBox="-15 -8 30 16">
            <Path d="M-13,6 L0,-6 L13,6 L6,6 L0,0.5 L-6,6 Z" fill="#FFB067" />
          </Svg>
        </Animated.View>
        {/* Level numbers */}
        <Animated.View style={[styles.numberWrap, oldNumberStyle]}>
          <Text style={[styles.number, { fontSize: numberSize, lineHeight: numberSize * 1.25 }]}>{previousLevel}</Text>
        </Animated.View>
        <Animated.View style={[styles.numberWrap, newNumberStyle]}>
          <Text style={[styles.number, { fontSize: numberSize, lineHeight: numberSize * 1.25 }]}>{level}</Text>
        </Animated.View>
        {/* Impact flash */}
        <Animated.View style={[StyleSheet.absoluteFill, flashStyle]}>
          <Svg width={BADGE_BOX} height={BADGE_BOX} viewBox="-150 -150 300 300">
            <Path d={hexPath(100)} fill="#FFF3E8" />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Sparks */}
      <View style={styles.sparkOrigin}>
        {SPARKS.map((spark, i) => (
          <Spark key={i} clock={clock} spark={spark} />
        ))}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Text

const LevelUpText: React.FC<{
  clock: SharedValue<number>;
  topShift: number;
  eyebrow: string;
  title: string;
  rankName: string;
  tierLabel: string;
  description: string;
}> = ({ clock, topShift, eyebrow, title, rankName, tierLabel, description }) => {
  const eyebrowStyle = useRollIn(clock, 120, 10);
  const titleStyle = useRollIn(clock, IMPACT + 160);
  const rankStyle = useRollIn(clock, IMPACT + 380);
  const descStyle = useRollIn(clock, IMPACT + 620, 10);
  const pillStyle = useAnimatedStyle(() => {
    const u = seg(clock.value, IMPACT + 560, IMPACT + 900);
    return { opacity: seg(clock.value, IMPACT + 560, IMPACT + 640), transform: [{ scale: 0.4 + 0.6 * backOut(u) }] };
  });

  return (
    <>
      <Animated.Text style={[styles.eyebrow, { top: textTop(143 - topShift, 14, 20) }, eyebrowStyle]} numberOfLines={1}>
        {eyebrow}
      </Animated.Text>
      <Animated.Text
        style={[styles.title, { top: textTop(183 - topShift, 28, 36) }, titleStyle]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {title}
      </Animated.Text>
      <Animated.View style={[styles.rankRow, { top: 651 - 18 - 0.35 * 24 }, rankStyle]}>
        <Text style={styles.rankName} numberOfLines={1}>
          {rankName}
        </Text>
        {!!tierLabel && (
          <Animated.View style={[styles.pill, pillStyle]}>
            <Text style={styles.pillText}>{tierLabel}</Text>
          </Animated.View>
        )}
      </Animated.View>
      <Animated.Text style={[styles.description, { top: textTop(685, 15, 22) }, descStyle]}>{description}</Animated.Text>
    </>
  );
};

// ---------------------------------------------------------------------------
// Screen

// Band intro, before the badge timeline (ms). The sound file starts with it.
const BAND_IN = 320;
const BAND_HOLD_END = 1150;
const BAND_INTRO = 1600;
const BAND_HEIGHT = 132;

/**
 * Opening, like the Rive file: the screen behind dims, a "LEVEL UP!" band
 * slides open across the middle, then the band grows to fill the screen and
 * becomes the level-up scene (`children`).
 */
const BandIntro: React.FC<{ band: SharedValue<number>; width: number; height: number; children: ReactNode }> = ({
  band,
  width,
  height,
  children,
}) => {
  const backdropStyle = useAnimatedStyle(() => ({ opacity: seg(band.value, 0, BAND_IN) }));

  const maskStyle = useAnimatedStyle(() => {
    const t = band.value;
    const grow = cubicInOut(seg(t, BAND_HOLD_END, BAND_INTRO));
    const h = BAND_HEIGHT + (height - BAND_HEIGHT) * grow;
    return {
      top: (height - h) / 2,
      height: h,
      transform: [{ scaleX: cubicOut(seg(t, 0, BAND_IN)) }],
    };
  });

  // Keeps the scene still on screen while the mask around it grows.
  const sceneStyle = useAnimatedStyle(() => {
    const grow = cubicInOut(seg(band.value, BAND_HOLD_END, BAND_INTRO));
    const h = BAND_HEIGHT + (height - BAND_HEIGHT) * grow;
    return { top: -(height - h) / 2 };
  });

  const tintStyle = useAnimatedStyle(() => ({ opacity: 1 - seg(band.value, BAND_HOLD_END, BAND_INTRO) }));

  const edgeStyle = useAnimatedStyle(() => ({ opacity: 1 - seg(band.value, BAND_HOLD_END + 200, BAND_INTRO) }));

  const labelStyle = useAnimatedStyle(() => {
    const t = band.value;
    const pop = seg(t, 180, 480);
    const out = seg(t, BAND_HOLD_END, BAND_HOLD_END + 220);
    return {
      opacity: Math.min(seg(t, 180, 300), 1 - out),
      transform: [{ scale: 1.5 - 0.5 * backOut(pop) + 0.25 * out }],
    };
  });

  const shineStyle = useAnimatedStyle(() => {
    const u = cubicOut(seg(band.value, 420, 1050));
    return {
      opacity: u > 0 && u < 1 ? 1 : 0,
      transform: [{ translateX: -160 + u * (width + 320) }, { skewX: '-20deg' }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} pointerEvents="none" />
      <Animated.View style={[styles.bandMask, maskStyle]} pointerEvents="box-none">
        <Animated.View style={[{ position: 'absolute', left: 0, width, height }, sceneStyle]}>{children}</Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.bandTint, tintStyle]} pointerEvents="none" />
        <Animated.View style={[styles.bandShine, shineStyle]} pointerEvents="none" />
        <Animated.View style={[styles.bandEdge, { top: 0 }, edgeStyle]} pointerEvents="none" />
        <Animated.View style={[styles.bandEdge, { bottom: 0 }, edgeStyle]} pointerEvents="none" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.bandLabelWrap, labelStyle]} pointerEvents="none">
        <Text style={styles.bandLabel}>LEVEL UP!</Text>
      </Animated.View>
    </View>
  );
};

export const LevelUpReward: React.FC<LevelUpRewardProps> = ({
  level,
  previousLevel = Math.max(0, level - 1),
  eyebrow = LEVEL_UP_DEFAULTS.eyebrow,
  title = `You’ve Reached Level ${level}`,
  rankName = LEVEL_UP_DEFAULTS.rankName,
  tierLabel = LEVEL_UP_DEFAULTS.tierLabel,
  description = LEVEL_UP_DEFAULTS.description,
  buttonLabel = LEVEL_UP_DEFAULTS.buttonLabel,
  onClose,
  onPress,
  sound = true,
  haptics = true,
}) => {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, Poppins_900Black_Italic });
  const player = useAudioPlayer(require('../../../assets/sounds/level_up.mp3'));
  const { isLoaded } = useAudioPlayerStatus(player);
  const [timedOut, setTimedOut] = useState(false);
  const [started, setStarted] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const band = useSharedValue(0);
  const clock = useSharedValue(0);
  const idle = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => { });
    const timeout = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  const ready = size.h > 0 && ((fontsLoaded && (!sound || isLoaded)) || timedOut);

  // Starts the band intro, then the badge timeline, with the sound and haptics.
  useEffect(() => {
    if (!ready || started) return;
    setStarted(true);
    band.value = withTiming(BAND_INTRO, { duration: BAND_INTRO, easing: Easing.linear });
    clock.value = withDelay(BAND_INTRO, withTiming(INTRO_END, { duration: INTRO_END, easing: Easing.linear }));
    idle.value = withDelay(BAND_INTRO, withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false));
    spin.value = withRepeat(withTiming(1, { duration: 60000, easing: Easing.linear }), -1, false);

    // Browsers block sound until the page has been tapped once (e.g. right
    // after a refresh); skip it there instead of throwing.
    const blocked =
      Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === false;
    if (sound && isLoaded && !blocked) {
      try {
        player.volume = 0.8;
        player.seekTo(0).catch(() => { });
        player.play();
      } catch (err) {
        console.warn('Could not play level up sound:', err);
      }
    }
    if (haptics && Platform.OS !== 'web') {
      const taps = [
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { }), 250),
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }), BAND_HOLD_END),
        setTimeout(
          () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { }),
          BAND_INTRO + IMPACT
        ),
      ];
      return () => taps.forEach(clearTimeout);
    }
  }, [ready, started, sound, haptics, isLoaded, player, band, clock, idle, spin]);

  return (
    <View
      style={styles.stage}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
      }}
    >
      {started && (
        <BandIntro band={band} width={size.w} height={size.h}>
          <DiamondRewardScene
            eyebrow=""
            title=""
            rewardName=""
            description=""
            buttonLabel={buttonLabel}
            onClose={onClose}
            onPress={onPress}
            hideDiamond
            renderOverlay={({ topShift }) => (
              <>
                <LevelBadge clock={clock} idle={idle} spin={spin} level={level} previousLevel={previousLevel} />
                <LevelUpText
                  clock={clock}
                  topShift={topShift}
                  eyebrow={eyebrow}
                  title={title}
                  rankName={rankName}
                  tierLabel={tierLabel}
                  description={description}
                />
              </>
            )}
          />
        </BandIntro>
      )}
    </View>
  );
};

export interface LevelUpRewardModalProps extends LevelUpRewardProps {
  visible: boolean;
}

/**
 * Modal version, shown over the current screen: the screen dims behind the
 * band, then the band fills the screen. The animation and sound replay every
 * time it opens. Android's back button calls `onClose`.
 */
export const LevelUpRewardModal: React.FC<LevelUpRewardModalProps> = ({ visible, ...props }) => (
  <Modal visible={visible} animationType="none" transparent={true} statusBarTranslucent={true} onRequestClose={props.onClose}>
    <LevelUpReward {...props} />
  </Modal>
);

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    // Transparent so the band intro opens over whatever is behind it.
    backgroundColor: 'transparent',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  bandMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  bandTint: {
    backgroundColor: 'rgba(8, 5, 4, 0.55)',
  },
  bandEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  bandShine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 90,
    backgroundColor: 'rgba(255, 210, 170, 0.12)',
  },
  bandLabelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandLabel: {
    fontFamily: 'Poppins_900Black_Italic',
    fontSize: 40,
    letterSpacing: 3,
    color: '#FFFFFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(246, 111, 40, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  badgeBox: {
    position: 'absolute',
    left: CENTER_X - BADGE_BOX / 2,
    top: BADGE_Y - BADGE_BOX / 2,
    width: BADGE_BOX,
    height: BADGE_BOX,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    left: BADGE_BOX / 2 - 220,
    top: BADGE_BOX / 2 - 220,
    width: 440,
    height: 440,
  },
  tunnel: {
    position: 'absolute',
    left: BADGE_BOX / 2 - TUNNEL_SIZE / 2,
    top: BADGE_BOX / 2 - TUNNEL_SIZE / 2,
    width: TUNNEL_SIZE,
    height: TUNNEL_SIZE,
  },
  dashCircle: {
    position: 'absolute',
    left: BADGE_BOX / 2 - 50,
    top: BADGE_BOX / 2 - 50,
    width: 100,
    height: 100,
  },
  chevron: {
    position: 'absolute',
    left: BADGE_BOX / 2 - 15,
    top: BADGE_BOX / 2 - 70,
  },
  numberWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontFamily: 'Poppins_900Black_Italic',
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlign: 'center',
    // Optical centering: the italic leans right and the digits sit low.
    marginLeft: -4,
    marginTop: 8,
    textShadowColor: 'rgba(246, 111, 40, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  sparkOrigin: {
    position: 'absolute',
    left: BADGE_BOX / 2,
    top: BADGE_BOX / 2,
    width: 0,
    height: 0,
  },
  centered: {
    position: 'absolute',
  },
  eyebrow: {
    position: 'absolute',
    left: 16,
    right: 16,
    textAlign: 'center',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 4.5,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  title: {
    position: 'absolute',
    left: 16,
    right: 16,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  rankRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  rankName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    lineHeight: 36,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  pill: {
    backgroundColor: ORANGE,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  pillText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.6,
    color: '#1A0D06',
  },
  description: {
    position: 'absolute',
    left: 24,
    right: 24,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
