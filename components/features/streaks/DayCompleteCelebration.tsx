import React, { useEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Polygon, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';

import { fontFamilies } from '@/theme/typography';
import type { WeekStatus } from '@/types/user';
import { FLAME_ASPECT, FLAME_COLORS_UNLIT, StreakFlame } from './StreakFlame';
import { generateWeekDaysFromWeekStatus, type DayTrackerItem } from './WeeklyTracker';

// Day complete screen, shown when the user finishes the day's quests.
// Modelled on the Duolingo streak screen, with the app's streak flame in
// place of the mascot:
//
//   1. An unlit grey flame and yesterday's count.
//   2. The flame squashes and wobbles while sparks are pulled in.
//   3. It ignites: a flash, a burst of embers, warm light and slow rays
//      fill the screen, and the flame springs up in colour.
//   4. The count rolls up to today's.
//   5. Everything slides up, "day streak" and the week appear, and the
//      days tick in one by one, today last with a pop.
//   6. Continue slides in.

const REWARD_BUTTON = '#FE5B01';
const BG = '#020203';
const FLAME_W = 150;
const FLAME_H = FLAME_W * FLAME_ASPECT;
const NUMBER_H = 112;
const BUTTON_HEIGHT = 50;
const BUTTON_BOTTOM_GAP = 48;
/** How far the hero sits lower before the week slides in under it. */
const HERO_DROP = 74;

// Timeline (ms).
const CHARGE_AT = 450;
const IGNITE_AT = 1250;
const ROLL_AT = 1650;
const SHIFT_AT = 2300;
const WEEK_AT = 2550;
const DAY_STAGGER = 110;

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

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

/** Slow sunburst behind the flame. */
function Rays({ size }: { size: number }) {
  const c = size / 2;
  const count = 14;
  const half = (Math.PI / count) * 0.42;
  const points = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const p1 = `${c + Math.cos(a - half) * c},${c + Math.sin(a - half) * c}`;
    const p2 = `${c + Math.cos(a + half) * c},${c + Math.sin(a + half) * c}`;
    return `${c},${c} ${p1} ${p2}`;
  });
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="rayFade" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FF8A1F" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#FF8A1F" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {points.map((p, i) => (
        <Polygon key={i} points={p} fill="url(#rayFade)" />
      ))}
    </Svg>
  );
}

// Sparks pulled into the flame while it charges: angle (deg), phase.
const CHARGE_SPARKS = Array.from({ length: 10 }, (_, i) => ({ angle: i * 36 + (i % 2) * 14, phase: (i % 5) * 0.16 }));

function ChargeSpark({ charge, angle, phase }: { charge: SharedValue<number> } & (typeof CHARGE_SPARKS)[number]) {
  const style = useAnimatedStyle(() => {
    const t = clamp01(charge.value * 1.6 - phase);
    const r = 130 * (1 - t) + 12;
    const a = (angle * Math.PI) / 180;
    return {
      opacity: interpolate(t, [0, 0.2, 0.9, 1], [0, 1, 1, 0]),
      transform: [{ translateX: Math.cos(a) * r }, { translateY: Math.sin(a) * r }, { scale: 0.6 + 0.6 * t }],
    };
  });
  return <Animated.View style={[styles.chargeSpark, style]} />;
}

// Embers thrown out on ignition: angle (deg), reach, colour.
const BURST_COLORS = ['#FFD84D', '#FF9B2F', '#FF4F1F', '#FFF7CC'];
const BURST = Array.from({ length: 16 }, (_, i) => ({
  angle: -90 + (i - 7.5) * 22 + (i % 3) * 6,
  reach: 110 + (i % 4) * 34,
  color: BURST_COLORS[i % 4],
  size: 5 + (i % 3) * 2,
}));

function BurstEmber({ burst, angle, reach, color, size }: { burst: SharedValue<number> } & (typeof BURST)[number]) {
  const style = useAnimatedStyle(() => {
    const t = burst.value;
    const r = reach * (1 - Math.pow(1 - t, 3));
    const a = (angle * Math.PI) / 180;
    return {
      opacity: interpolate(t, [0, 0.04, 0.75, 1], [0, 1, 0.9, 0]),
      transform: [
        { translateX: Math.cos(a) * r },
        { translateY: Math.sin(a) * r + 60 * t * t },
        { rotate: `${t * 240}deg` },
        { scale: 1 - 0.4 * t },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.burstEmber, { width: size, height: size * 1.4, marginLeft: -size / 2, backgroundColor: color }, style]}
    />
  );
}

// Embers drifting up once the flame is lit: x offset, phase, drift.
const RISING = [
  { x: -40, phase: 0, drift: -10 },
  { x: 30, phase: 0.2, drift: 12 },
  { x: -12, phase: 0.42, drift: -6 },
  { x: 48, phase: 0.6, drift: 8 },
  { x: 6, phase: 0.8, drift: -12 },
];

function RisingEmber({ clock, lit, x, phase, drift }: {
  clock: SharedValue<number>;
  lit: SharedValue<number>;
} & (typeof RISING)[number]) {
  const style = useAnimatedStyle(() => {
    const t = (clock.value + phase) % 1;
    return {
      opacity: interpolate(t, [0, 0.15, 0.8, 1], [0, 1, 0.6, 0]) * lit.value,
      transform: [
        { translateX: x + drift * t + Math.sin(t * 9) * 4 },
        { translateY: -150 * t },
        { scale: 1 - 0.5 * t },
      ],
    };
  });
  return <Animated.View style={[styles.risingEmber, style]} />;
}

const TODAY_CONFETTI = Array.from({ length: 8 }, (_, i) => ({
  angle: i * 45 - 90,
  color: BURST_COLORS[i % 4],
}));

function DayConfetti({ pop, angle, color }: { pop: SharedValue<number>; angle: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const t = pop.value;
    const r = 34 * (1 - Math.pow(1 - t, 2));
    const a = (angle * Math.PI) / 180;
    return {
      opacity: t === 0 ? 0 : interpolate(t, [0, 0.1, 0.7, 1], [0, 1, 1, 0]),
      transform: [{ translateX: Math.cos(a) * r }, { translateY: Math.sin(a) * r }, { rotate: `${angle + t * 180}deg` }],
    };
  });
  return <Animated.View style={[styles.dayConfetti, { backgroundColor: color }, style]} />;
}

function WeekDay({ day, fillAt, isToday }: { day: DayTrackerItem; fillAt: number | null; isToday: boolean }) {
  const fill = useSharedValue(0);
  const pop = useSharedValue(0);

  useEffect(() => {
    if (fillAt === null) return;
    fill.value = withDelay(fillAt, withSpring(1, { damping: isToday ? 7 : 11, stiffness: 220 }));
    if (isToday) pop.value = withDelay(fillAt, withTiming(1, { duration: 650, easing: Easing.out(Easing.quad) }));
  }, [fill, fillAt, isToday, pop]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: clamp01(fill.value * 3),
    transform: [{ scale: fill.value * (isToday ? 1 : 1) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: pop.value === 0 ? 0 : 1 - pop.value,
    transform: [{ scale: 1 + 0.9 * pop.value }],
  }));

  const label = day.dayName.slice(0, 1) + day.dayName.slice(1, 2).toLowerCase();
  const filled = fillAt !== null;

  return (
    <View style={styles.day}>
      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
      <View style={styles.dayCircleBox}>
        <View style={[styles.dayCircle, day.status === 'missed' && styles.dayMissed]}>
          {day.status === 'missed' && <View style={styles.missedDash} />}
          {day.status === 'freeze' && <Ionicons name="snow" size={14} color="#7DB7FF" />}
        </View>
        {filled && (
          <>
            {isToday && <Animated.View style={[styles.todayRing, ringStyle]} />}
            <Animated.View style={[styles.dayCircle, isToday ? styles.dayToday : styles.dayDone, fillStyle]}>
              <Ionicons name={isToday ? 'flame' : 'checkmark'} size={isToday ? 17 : 16} color={isToday ? REWARD_BUTTON : '#FFFFFF'} />
            </Animated.View>
            {isToday && (
              <View style={styles.dayOrigin} pointerEvents="none">
                {TODAY_CONFETTI.map((c, i) => (
                  <DayConfetti key={i} pop={pop} {...c} />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

export interface DayCompleteCelebrationProps {
  /** The streak including today; the count rolls up from streakDays - 1. */
  streakDays: number;
  /** The week row comes from this (as on the home tracker). */
  weekStatus?: WeekStatus | null;
  /** Or pass the days directly. */
  days?: DayTrackerItem[];
  /** Shown as a "+N XP" chip when given. */
  xp?: number;
  message?: string;
  buttonLabel?: string;
  onContinue?: () => void;
  /** Defaults to true. */
  sound?: boolean;
  /** Defaults to true. */
  haptics?: boolean;
}

export const DayCompleteCelebration: React.FC<DayCompleteCelebrationProps> = ({
  streakDays,
  weekStatus,
  days,
  xp,
  message = 'All of today’s quests are done. Come back tomorrow to keep the fire going.',
  buttonLabel = 'Continue',
  onContinue,
  sound = true,
  haptics = true,
}) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const buttonGap = Math.max(insets.bottom + 16, BUTTON_BOTTOM_GAP);
  const from = Math.max(0, streakDays - 1);

  const week = useMemo(() => (days?.length ? days : generateWeekDaysFromWeekStatus(weekStatus)), [days, weekStatus]);
  // Done days tick in left to right, today last.
  const fillTimes = useMemo(() => {
    let n = 0;
    const times = week.map((d) => (d.status === 'completed' ? WEEK_AT + 260 + DAY_STAGGER * n++ : null));
    const todayAt = WEEK_AT + 260 + DAY_STAGGER * n + 220;
    return { times: week.map((d, i) => (d.status === 'today' ? todayAt : times[i])), todayAt };
  }, [week]);
  const buttonAt = fillTimes.todayAt + 650;

  const igniteSound = useAudioPlayer(require('../../../assets/sounds/streak_ignite.m4a'));
  const countSound = useAudioPlayer(require('../../../assets/sounds/streak_count_up.m4a'));
  const checkSound = useAudioPlayer(require('../../../assets/sounds/streak_day_check.m4a'));

  const appear = useSharedValue(0);
  const charge = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const tilt = useSharedValue(0);
  const grow = useSharedValue(0.78);
  const lit = useSharedValue(0);
  const flash = useSharedValue(0);
  const burst = useSharedValue(0);
  const roll = useSharedValue(0);
  const shift = useSharedValue(0);
  const weekIn = useSharedValue(0);
  const button = useSharedValue(0);
  const rays = useSharedValue(0);
  const emberClock = useSharedValue(0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const tick = () => haptics && Haptics.selectionAsync().catch(() => {});

    appear.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) });

    // Charge: squash and stretch, faster and deeper, while sparks gather.
    const t = (to: number, ms: number) => withTiming(to, { duration: ms, easing: Easing.inOut(Easing.quad) });
    sy.value = withDelay(
      CHARGE_AT,
      withSequence(
        t(0.84, 170), t(1.05, 150), t(0.8, 150), t(1.04, 120), t(0.72, 190),
        withTiming(1.3, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 7, stiffness: 160 })
      )
    );
    sx.value = withDelay(
      CHARGE_AT,
      withSequence(
        t(1.12, 170), t(0.97, 150), t(1.16, 150), t(0.98, 120), t(1.22, 190),
        withTiming(0.84, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 7, stiffness: 160 })
      )
    );
    tilt.value = withDelay(
      CHARGE_AT + 300,
      withSequence(...[-1, 1, -1, 1, -0.6, 0].map((to) => withTiming(to, { duration: 70 })))
    );
    charge.value = withDelay(CHARGE_AT, withTiming(1, { duration: IGNITE_AT - CHARGE_AT, easing: Easing.in(Easing.quad) }));
    at(CHARGE_AT, tick);
    at(CHARGE_AT + 320, tick);
    at(CHARGE_AT + 620, tick);

    // Ignite.
    lit.value = withDelay(IGNITE_AT, withTiming(1, { duration: 160 }));
    grow.value = withDelay(IGNITE_AT, withSpring(1, { damping: 9, stiffness: 140 }));
    flash.value = withDelay(IGNITE_AT, withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 520 })));
    burst.value = withDelay(IGNITE_AT, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
    rays.value = withDelay(IGNITE_AT, withRepeat(withTiming(1, { duration: 26000, easing: Easing.linear }), -1));
    emberClock.value = withDelay(IGNITE_AT, withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1));
    at(IGNITE_AT, () => {
      if (sound) playOnce(igniteSound);
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    });

    // Count up.
    roll.value = withDelay(ROLL_AT, withSpring(1, { damping: 11, stiffness: 120 }));
    at(ROLL_AT, () => {
      if (sound) playOnce(countSound);
      if (haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });

    // Slide up, then the week.
    shift.value = withDelay(SHIFT_AT, withSpring(1, { damping: 16, stiffness: 120 }));
    weekIn.value = withDelay(WEEK_AT, withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }));
    at(fillTimes.todayAt, () => {
      if (sound) playOnce(checkSound);
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    });
    fillTimes.times.forEach((ms) => ms !== null && ms !== fillTimes.todayAt && at(ms, tick));

    button.value = withDelay(buttonAt, withSpring(1, { damping: 15, stiffness: 140 }));

    return () => timers.forEach(clearTimeout);
    // Runs once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const raySize = height * 1.25;
  const floodSize = height * 1.1;

  const sceneStyle = useAnimatedStyle(() => ({ opacity: appear.value }));
  const floodStyle = useAnimatedStyle(() => ({
    opacity: lit.value,
    transform: [{ scale: 0.3 + 0.7 * clamp01(burst.value * 1.6) }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: lit.value * (0.6 + 0.4 * clamp01(burst.value * 2)),
    transform: [{ rotate: `${rays.value * 360}deg` }, { scale: 0.6 + 0.4 * clamp01(burst.value * 1.5) }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.85 }));
  const columnStyle = useAnimatedStyle(() => ({ transform: [{ translateY: HERO_DROP * (1 - shift.value) }] }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${tilt.value * 5}deg` },
      { scaleX: sx.value * grow.value },
      { scaleY: sy.value * grow.value },
    ],
  }));
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  const unlitStyle = useAnimatedStyle(() => ({ opacity: 1 - lit.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: Math.max(lit.value, charge.value * 0.35),
    transform: [{ scale: 0.6 + 0.4 * Math.max(lit.value, charge.value * 0.5) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: burst.value === 0 ? 0 : interpolate(burst.value, [0, 0.05, 0.6], [0, 0.9, 0], Extrapolation.CLAMP),
    transform: [{ scale: 0.3 + 2.4 * burst.value }],
  }));
  const oldNumberStyle = useAnimatedStyle(() => ({
    opacity: 1 - clamp01(roll.value * 1.5),
    transform: [{ translateY: 70 * roll.value }],
  }));
  const newNumberStyle = useAnimatedStyle(() => ({
    opacity: clamp01(roll.value * 1.5),
    color: interpolateColor(clamp01(roll.value), [0, 0.6, 1], ['#FFFFFF', '#FFE2A3', '#FFC24A']),
    transform: [{ translateY: -70 * (1 - roll.value) }, { scale: interpolate(roll.value, [0, 1], [0.7, 1]) }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: shift.value,
    transform: [{ translateY: 12 * (1 - shift.value) }],
  }));
  const weekStyle = useAnimatedStyle(() => ({
    opacity: weekIn.value,
    transform: [{ translateY: 16 * (1 - weekIn.value) }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: clamp01(button.value),
    transform: [{ translateY: 40 * (1 - button.value) }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]}>
        {/* Warm light and rays, centered on the flame's final spot. */}
        <View style={[styles.lightOrigin, { top: height * 0.34 }]} pointerEvents="none">
          <Animated.View style={[styles.centered, { width: floodSize, height: floodSize }, floodStyle]}>
            <Blob size={floodSize} color="#FF5A00" opacity={0.42} id="flood" />
          </Animated.View>
          <Animated.View style={[styles.centered, { width: raySize, height: raySize }, raysStyle]}>
            <Rays size={raySize} />
          </Animated.View>
        </View>

        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: buttonGap + BUTTON_HEIGHT + 24 }]}>
          <Animated.View style={[styles.column, columnStyle]}>
            <View style={styles.flameStage}>
              <Animated.View style={[styles.centered, styles.flameGlow, glowStyle]}>
                <Blob size={300} color="#FF6A00" opacity={0.55} id="flameGlow" />
              </Animated.View>
              <View style={styles.fxOrigin} pointerEvents="none">
                <Animated.View style={[styles.ring, ringStyle]} />
                {CHARGE_SPARKS.map((s, i) => (
                  <ChargeSpark key={i} charge={charge} {...s} />
                ))}
                {BURST.map((b, i) => (
                  <BurstEmber key={i} burst={burst} {...b} />
                ))}
                {RISING.map((r, i) => (
                  <RisingEmber key={i} clock={emberClock} lit={lit} {...r} />
                ))}
              </View>
              <Animated.View style={[styles.flame, flameStyle]}>
                <Animated.View style={[StyleSheet.absoluteFill, unlitStyle]}>
                  <StreakFlame width={FLAME_W} colors={FLAME_COLORS_UNLIT} flicker={false} />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, litStyle]}>
                  <StreakFlame width={FLAME_W} />
                </Animated.View>
              </Animated.View>
            </View>

            <View style={styles.numberBox}>
              <Animated.Text style={[styles.number, styles.numberOld, oldNumberStyle]}>{from}</Animated.Text>
              <Animated.Text style={[styles.number, newNumberStyle]}>{streakDays}</Animated.Text>
            </View>
            <Animated.Text style={[styles.label, labelStyle]}>day streak</Animated.Text>

            <Animated.View style={[styles.weekBlock, weekStyle]}>
              <View style={styles.weekRow}>
                {week.map((d, i) => (
                  <WeekDay key={`${d.dayName}${i}`} day={d} fillAt={fillTimes.times[i]} isToday={d.status === 'today'} />
                ))}
              </View>
              {!!message && <Text style={styles.message}>{message}</Text>}
              {typeof xp === 'number' && xp > 0 && (
                <View style={styles.xpChip}>
                  <Ionicons name="flash" size={13} color="#FFC24A" />
                  <Text style={styles.xpText}>+{xp} XP</Text>
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, { paddingBottom: buttonGap }, buttonStyle]}>
          <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} onPress={onContinue}>
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  lightOrigin: {
    position: 'absolute',
    left: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  column: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  flameStage: {
    width: FLAME_W,
    height: FLAME_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGlow: {
    width: 300,
    height: 300,
  },
  flame: {
    width: FLAME_W,
    height: FLAME_H,
    transformOrigin: 'bottom',
  },
  fxOrigin: {
    position: 'absolute',
    left: FLAME_W / 2,
    top: FLAME_H * 0.62,
    width: 0,
    height: 0,
  },
  ring: {
    position: 'absolute',
    left: -60,
    top: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFC24A',
  },
  chargeSpark: {
    position: 'absolute',
    left: -3,
    top: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFB347',
  },
  burstEmber: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
  risingEmber: {
    position: 'absolute',
    left: -2,
    top: -20,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFB347',
  },
  numberBox: {
    height: NUMBER_H,
    alignSelf: 'stretch',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  number: {
    position: 'absolute',
    fontFamily: fontFamilies.bold,
    fontSize: 96,
    lineHeight: NUMBER_H,
    letterSpacing: -2,
    color: '#FFC24A',
  },
  numberOld: {
    color: '#3A3A42',
  },
  label: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 22,
    color: '#FFFFFF',
    marginTop: -6,
  },
  weekBlock: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 28,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  day: {
    alignItems: 'center',
    width: 38,
  },
  dayLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    color: '#71717A',
    marginBottom: 8,
  },
  dayLabelToday: {
    color: '#FFFFFF',
  },
  dayCircleBox: {
    width: 34,
    height: 34,
  },
  dayCircle: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayMissed: {
    backgroundColor: '#141417',
  },
  missedDash: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#3F3F46',
  },
  dayDone: {
    backgroundColor: '#FF9B2F',
    borderColor: '#FFB860',
  },
  dayToday: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  todayRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#FFC24A',
  },
  dayOrigin: {
    position: 'absolute',
    left: 17,
    top: 17,
    width: 0,
    height: 0,
  },
  dayConfetti: {
    position: 'absolute',
    left: -2.5,
    top: -4,
    width: 5,
    height: 8,
    borderRadius: 1.5,
  },
  message: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 16,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,155,47,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,155,47,0.35)',
  },
  xpText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: '#FFC24A',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  button: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    backgroundColor: REWARD_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 17,
    letterSpacing: -0.43,
    color: '#FFFFFF',
  },
  flash: {
    backgroundColor: '#FFE2A8',
  },
});
