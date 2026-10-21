import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';

import { fontFamilies } from '@/theme/typography';
import type { FlightRect } from './StreakBadgeShowcase';
import { OUTER_FLAME, StreakFlame } from './StreakFlame';

// Streak break card: one reusable popup for a missed day. Give it how many
// streak lives are left, e.g. <StreakBreakModal visible livesLeft={1}
// streakDays={16} /> or showStreakBreak({ livesLeft: 0, streakDays: 16 }).
//
// One streak flame (like the one in the home header) burns in the middle and
// the life count rolls down (e.g. 2 → 1). When the last life goes, the
// flame goes out in smoke. The button flies the flame into the streak pill
// in the home header ("Start Again" lights a new one first).
//
// Sound: a soft fall as the count drops.
//
// Usually shown with showStreakBreak() (GlobalStreakBreak is mounted in
// the root layout and the home screen watches streak_lives).

const REWARD_BUTTON = '#FE5B01';
const MAX_LIVES = 2;

// Stage geometry (points).
const STAGE_W = 220;
const STAGE_H = 180;
const FLAME_W = 100;
const FLAME_H = 130;
const FLAME_LEFT = (STAGE_W - FLAME_W) / 2;
const FLAME_TOP = STAGE_H - 18 - FLAME_H;

// Timeline (ms from the card opening).
const IGNITE_AT = 150;
const ROLL_AT = 1100;
const OUT_AT = 1500;
const OUT_MS = 650;

// Button → (relight and) fly into the header pill (ms).
const RELIGHT_MS = 380;
const FLY_MS = 720;
const LAND_MS = 420;
/** How high the flame arcs above the straight line while flying. */
const FLY_ARC = 90;

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/** A soft radial blob (glows, smoke). */
function Blob({ size, color, opacity = 1, id }: { size: number; color: string; opacity?: number; id: string }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/** The streak flame, filling a FLAME_W × FLAME_H box. */
const FlameStack = () => <StreakFlame width={FLAME_W} />;

const measureInWindow = (view: View | null) =>
  new Promise<FlightRect | null>((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
  });

/** Browsers block sound until the page has been tapped once; skip it there. */
const canPlaySound = () =>
  !(Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === false);

const playOnce = (player: AudioPlayer) => {
  if (!canPlaySound()) return;
  try {
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {}
};

/**
 * The flame for the button: lights up where the card's flame is (when
 * `lit`, it is already burning), then arcs into `to` (the header pill's
 * flame icon) and shrinks to its size.
 * Coordinates are relative to the card's root.
 */
function FlyingFlame({ from, to, lit, onLanded, onDone }: {
  from: FlightRect;
  lit: boolean;
  to: FlightRect;
  onLanded: () => void;
  onDone: () => void;
}) {
  const relight = useSharedValue(lit ? 1 : 0);
  const fly = useSharedValue(0);
  const land = useSharedValue(0);

  useEffect(() => {
    if (!lit) relight.value = withTiming(1, { duration: RELIGHT_MS, easing: Easing.out(Easing.back(1.6)) });
    fly.value = withDelay(
      lit ? 80 : RELIGHT_MS + 120,
      withTiming(1, { duration: FLY_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (!done) return;
        runOnJS(onLanded)();
        land.value = withTiming(1, { duration: LAND_MS, easing: Easing.out(Easing.quad) }, (ok) => {
          if (ok) runOnJS(onDone)();
        });
      })
    );
    // Runs once per flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fromX = from.x + from.width / 2;
  const fromY = from.y + from.height / 2;
  const toX = to.x + to.width / 2;
  const toY = to.y + to.height / 2;
  const endScale = (to.height * 1.15) / FLAME_H;

  const flameStyle = useAnimatedStyle(() => {
    const t = fly.value;
    return {
      opacity: 1 - land.value,
      transform: [
        { translateX: fromX - FLAME_W / 2 + (toX - fromX) * t },
        { translateY: fromY - FLAME_H / 2 + (toY - fromY) * t - Math.sin(Math.PI * t) * FLY_ARC },
        { scale: (1 + (endScale - 1) * t) * (0.06 + 0.94 * relight.value) },
        { rotate: `${Math.sin(Math.PI * t) * -14}deg` },
      ],
    };
  });
  const glowStyle = useAnimatedStyle(() => {
    const t = fly.value;
    const size = 200 * (1 + (endScale * 1.8 - 1) * t);
    return {
      opacity: relight.value * (1 - land.value) * 0.9,
      width: size,
      height: size,
      transform: [
        { translateX: fromX + (toX - fromX) * t - size / 2 },
        { translateY: fromY + (toY - fromY) * t - Math.sin(Math.PI * t) * FLY_ARC - size / 2 },
      ],
    };
  });
  const flashStyle = useAnimatedStyle(() => ({
    opacity: land.value === 0 ? 0 : 1 - land.value,
    transform: [{ translateX: toX - 30 }, { translateY: toY - 30 }, { scale: 0.4 + 1.4 * land.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.flyGlow, glowStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="flyGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FF5500" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#FF5500" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={100} cy={100} r={100} fill="url(#flyGlow)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.flyFlame, flameStyle]}>
        <FlameStack />
      </Animated.View>
      <Animated.View style={[styles.flyFlash, flashStyle]}>
        <Blob size={60} color="#FFC24A" opacity={0.95} id="landFlash" />
      </Animated.View>
    </View>
  );
}

// Embers drifting up around the flame: x offset, phase, drift.
const EMBERS = [
  { x: -22, phase: 0, drift: -10 },
  { x: 14, phase: 0.22, drift: 12 },
  { x: -6, phase: 0.45, drift: -6 },
  { x: 26, phase: 0.63, drift: 8 },
  { x: 2, phase: 0.81, drift: -12 },
];

function Ember({ clock, alive, x, phase, drift }: {
  clock: SharedValue<number>;
  alive: SharedValue<number>;
} & (typeof EMBERS)[number]) {
  const style = useAnimatedStyle(() => {
    const t = (clock.value + phase) % 1;
    return {
      opacity: interpolate(t, [0, 0.15, 0.8, 1], [0, 1, 0.6, 0]) * alive.value,
      transform: [
        { translateX: x + drift * t + Math.sin(t * 9) * 3 },
        { translateY: -110 * t },
        { scale: 1 - 0.5 * t },
      ],
    };
  });
  return <Animated.View style={[styles.ember, style]} />;
}

// Smoke puffs for the burn-out: start offset (ms), x drift, size.
const PUFFS = [
  { delay: 0, drift: -14, size: 34 },
  { delay: 220, drift: 12, size: 42 },
  { delay: 460, drift: -6, size: 38 },
  { delay: 700, drift: 16, size: 30 },
  { delay: 980, drift: -12, size: 36 },
  { delay: 1300, drift: 6, size: 28 },
];
const PUFF_MS = 1900;
const SMOKE_MS = 1300 + PUFF_MS;

function SmokePuff({ smoke, delay, drift, size }: { smoke: SharedValue<number> } & (typeof PUFFS)[number]) {
  const style = useAnimatedStyle(() => {
    const t = clamp01((smoke.value * SMOKE_MS - delay) / PUFF_MS);
    return {
      opacity: interpolate(t, [0, 0.15, 0.6, 1], [0, 0.55, 0.3, 0]),
      transform: [
        { translateX: drift * t + Math.sin(t * Math.PI * 2) * 6 },
        { translateY: -120 * t },
        { scale: 0.35 + 1.5 * t },
      ],
    };
  });
  return (
    <Animated.View style={[styles.abs, { width: size, height: size, left: -size / 2, top: -size / 2 }, style]}>
      <Blob size={size} color="#B4B4BE" opacity={0.9} id={`smoke${delay}`} />
    </Animated.View>
  );
}

export interface StreakBreakCardProps {
  /** Lives left after the miss: 1 or more plays "life used", 0 plays the flame going out. */
  livesLeft: number;
  /** How many lives the miss cost (the count rolls from livesLeft + livesLost). Defaults to 1. */
  livesLost?: number;
  /** The streak the life protected, or the one that ended. */
  streakDays: number;
  onClose?: () => void;
  /** Defaults to true. */
  haptics?: boolean;
  /** Defaults to true. */
  sound?: boolean;
  /**
   * When given, the button flies the flame to this spot
   * (window coordinates, e.g. the home header's streak pill) before onClose.
   */
  getFlightTarget?: () => Promise<FlightRect | null>;
  /** Called the moment the flying flame lands. */
  onLanded?: () => void;
}

export const StreakBreakCard: React.FC<StreakBreakCardProps> = ({
  livesLeft,
  livesLost = 1,
  streakDays,
  onClose,
  haptics = true,
  sound = true,
  getFlightTarget,
  onLanded,
}) => {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 340);
  const after = Math.min(MAX_LIVES, Math.max(0, livesLeft));
  const before = Math.min(MAX_LIVES, after + Math.max(1, livesLost));
  const burnsOut = after === 0;

  const enter = useSharedValue(0);
  /** 1 = burning, 0 = out. */
  const flame = useSharedValue(0);
  const roll = useSharedValue(0);
  const smoke = useSharedValue(0);
  const emberClock = useSharedValue(0);
  const [out, setOut] = useState(false);

  const lifeDrop = useAudioPlayer(require('../../../assets/sounds/life_drop.m4a'));
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // The button's flight to the header pill.
  const rootRef = useRef<View>(null);
  const flameBoxRef = useRef<View>(null);
  const sceneFade = useSharedValue(1);
  const [leaving, setLeaving] = useState(false);
  const [flight, setFlight] = useState<{ from: FlightRect; to: FlightRect } | null>(null);

  const flyHome = async () => {
    if (leaving) return;
    if (!getFlightTarget) return onClose?.();
    setLeaving(true);
    const [root, box] = await Promise.all([measureInWindow(rootRef.current), measureInWindow(flameBoxRef.current)]);
    sceneFade.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.quad) });
    const to = await Promise.race([
      getFlightTarget().catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (!to || !box) return onClose?.();
    const ox = root?.x ?? 0;
    const oy = root?.y ?? 0;
    setFlight({
      from: { ...box, x: box.x - ox, y: box.y - oy },
      to: { ...to, x: to.x - ox, y: to.y - oy },
    });
  };

  const handleLanded = () => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onLanded?.();
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const notify = (type: Haptics.NotificationFeedbackType) =>
      haptics && Haptics.notificationAsync(type).catch(() => {});
    const impact = (style: Haptics.ImpactFeedbackStyle) =>
      haptics && Haptics.impactAsync(style).catch(() => {});

    enter.value = withSpring(1, { damping: 14, stiffness: 140 });
    emberClock.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1);
    const ignite = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    flame.value = withDelay(
      IGNITE_AT,
      burnsOut
        ? withSequence(
            ignite,
            withDelay(OUT_AT - IGNITE_AT - 650, withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.quad) }))
          )
        : ignite
    );
    roll.value = withDelay(ROLL_AT, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
    at(ROLL_AT, () => sound && playOnce(lifeDrop));
    // Haptics follow the count as it rolls down: a heavy thud as the old
    // number drops away, a light tick as the new one pops in, and a firm tap
    // when it settles.
    at(ROLL_AT, () => impact(Haptics.ImpactFeedbackStyle.Heavy));
    at(ROLL_AT + 150, () => impact(Haptics.ImpactFeedbackStyle.Light));
    at(ROLL_AT + 380, () => impact(Haptics.ImpactFeedbackStyle.Rigid));

    if (burnsOut) {
      smoke.value = withDelay(OUT_AT + OUT_MS - 250, withTiming(1, { duration: SMOKE_MS, easing: Easing.linear }));
      at(OUT_AT + OUT_MS, () => {
        setOut(true);
        notify(Haptics.NotificationFeedbackType.Error);
      });
    }

    return () => timers.forEach(clearTimeout);
    // Runs once when the card opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: clamp01(enter.value) * sceneFade.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.5], [0, 1], Extrapolation.CLAMP) * sceneFade.value,
    transform: [{ translateY: 24 * (1 - enter.value) }, { scale: 0.92 + 0.08 * enter.value }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flame.value, [0, 0.1, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [{ scaleY: 0.06 + 0.94 * flame.value }, { scaleX: 0.3 + 0.7 * flame.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: flame.value,
    transform: [{ scale: 0.55 + 0.45 * flame.value }],
  }));
  const cardGlowStyle = useAnimatedStyle(() => ({ opacity: flame.value * 0.9 }));
  const oldNumberStyle = useAnimatedStyle(() => ({
    opacity: 1 - clamp01(roll.value * 1.6),
    transform: [{ translateY: -40 * roll.value }, { scale: 1 - 0.3 * roll.value }],
  }));
  const newNumberStyle = useAnimatedStyle(() => ({
    opacity: clamp01(roll.value * 1.4 - 0.2),
    color: burnsOut
      ? '#71717A'
      : interpolateColor(roll.value, [0, 0.5, 1], ['#FF8A1F', '#FFB347', '#FFFFFF']),
    transform: [
      { translateY: 40 * (1 - roll.value) },
      { scale: interpolate(roll.value, [0, 0.6, 1], [0.6, 1.2, 1]) },
    ],
  }));

  const lifeWord = (n: number) => (n === 1 ? 'life' : 'lives');
  const title = burnsOut ? 'Streak Lost' : 'Streak Saved';
  const body = burnsOut
    ? `You ran out of streak lives and your ${streakDays}-day streak burned out. Light a new one today.`
    : `You missed a day, so a streak life kept your ${streakDays}-day streak burning. ${after} ${lifeWord(after)} left. Don’t miss today.`;

  return (
    <View ref={rootRef} collapsable={false} style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, { width: cardWidth }, cardStyle]}>
          {/* Warm light from the flame across the top of the card. */}
          <Animated.View style={[styles.cardGlow, cardGlowStyle]} pointerEvents="none">
            <Blob size={cardWidth * 1.3} color="#FF5500" opacity={0.2} id="cardGlow" />
          </Animated.View>

          <View style={styles.stage}>
            <Animated.View style={[styles.glow, glowStyle]}>
              <Blob size={STAGE_W} color="#FF5500" opacity={0.5} id="flameGlow" />
            </Animated.View>

            {EMBERS.map((e, i) => (
              <Ember key={i} clock={emberClock} alive={flame} {...e} />
            ))}

            {/* Measured for the flight to the header pill. */}
            <View ref={flameBoxRef} collapsable={false} style={styles.flame} pointerEvents="none" />

            {/* What's left once it's out: a faint outline. */}
            {burnsOut && out && (
              <View style={[styles.flame, { opacity: 0.14 }]}>
                <Svg width={FLAME_W} height={FLAME_H} viewBox="0 0 100 130">
                  <Path d={OUTER_FLAME} fill="none" stroke="#A1A1AA" strokeWidth={3} />
                </Svg>
              </View>
            )}

            <Animated.View style={[styles.flame, styles.fromBottom, flameStyle]}>
              <FlameStack />
            </Animated.View>

            {burnsOut && (
              <View style={[styles.origin, { left: STAGE_W / 2, top: FLAME_TOP + 80 }]} pointerEvents="none">
                {PUFFS.map((p, i) => (
                  <SmokePuff key={i} smoke={smoke} {...p} />
                ))}
              </View>
            )}
          </View>

          <View style={styles.countRow}>
            <Animated.Text style={[styles.count, oldNumberStyle]}>{before}</Animated.Text>
            <Animated.Text style={[styles.count, newNumberStyle]}>{after}</Animated.Text>
          </View>
          <Text style={styles.countLabel}>{burnsOut && out ? 'NO LIVES LEFT' : 'STREAK LIVES'}</Text>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
            onPress={flyHome}
          >
            <Text style={styles.buttonText}>{burnsOut ? 'Start Again' : 'Keep Going'}</Text>
          </Pressable>
        </Animated.View>
      </View>

      {flight && (
        <FlyingFlame from={flight.from} to={flight.to} lit={!burnsOut} onLanded={handleLanded} onDone={() => onClose?.()} />
      )}
    </View>
  );
};

export interface StreakBreakModalProps extends StreakBreakCardProps {
  visible: boolean;
}

/** The card over a dimmed screen. Android's back button calls `onClose`. */
export const StreakBreakModal: React.FC<StreakBreakModalProps> = ({ visible, ...props }) => (
  <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={props.onClose}>
    <StreakBreakCard {...props} />
  </Modal>
);

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  fromBottom: {
    transformOrigin: 'bottom',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#121215',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#2A2A2F',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 22,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -140,
    alignSelf: 'center',
  },
  stage: {
    width: STAGE_W,
    height: STAGE_H,
  },
  glow: {
    position: 'absolute',
    left: 0,
    top: FLAME_TOP + FLAME_H / 2 - STAGE_W / 2,
    width: STAGE_W,
    height: STAGE_W,
  },
  flame: {
    position: 'absolute',
    left: FLAME_LEFT,
    top: FLAME_TOP,
    width: FLAME_W,
    height: FLAME_H,
  },
  ember: {
    position: 'absolute',
    left: STAGE_W / 2 - 1.5,
    top: FLAME_TOP + 60,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFB347',
  },
  flyGlow: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  flyFlame: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FLAME_W,
    height: FLAME_H,
  },
  flyFlash: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  // A 0×0 point that effects spread out from.
  origin: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  countRow: {
    height: 48,
    width: 120,
    overflow: 'hidden',
    alignItems: 'center',
  },
  count: {
    position: 'absolute',
    fontFamily: fontFamilies.bold,
    fontSize: 38,
    lineHeight: 48,
    color: '#FFFFFF',
  },
  countLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#A1A1AA',
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: '#FFFFFF',
    marginTop: 18,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#A1A1AA',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    height: 50,
    borderRadius: 25,
    backgroundColor: REWARD_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  buttonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 17,
    letterSpacing: -0.43,
    color: '#FFFFFF',
  },
});
