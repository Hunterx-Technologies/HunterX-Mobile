import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// The app's streak flame: flat four tones (red-orange outside with a second
// tongue on the right, then orange, yellow and a cream core), each layer
// flickering on its own beat. Used by the streak break card and the day
// complete screen.

/** Width : height of the flame (viewBox 100 × 130). */
export const FLAME_ASPECT = 1.3;

export const OUTER_FLAME =
  'M50 128 C24 128 8 110 8 86 C8 64 22 50 34 36 C42 27 47 16 46 2 C60 14 70 28 71 42 C72 50 70 56 72 62 C74 68 80 68 82 62 C84 58 84 52 82 46 C90 54 94 70 94 86 C94 110 76 128 50 128 Z';
const MID_FLAME =
  'M50 126 C30 126 17 112 17 93 C17 76 28 64 38 52 C44 45 49 37 51 27 C58 36 62 46 62 56 C62 64 62 72 68 76 C74 79 80 76 84 70 C86 77 87 85 87 93 C87 112 70 126 50 126 Z';
const INNER_FLAME =
  'M50 126 C36 126 26 117 26 104 C26 96 28 90 32 84 C32 90 34 95 38 95 C43 95 44 90 43 85 C42 76 46 68 53 60 C56 70 62 77 67 85 C71 91 73 97 73 104 C73 117 63 126 50 126 Z';
const CORE_FLAME =
  'M50 126 C42 126 37 121 37 114 C37 106 43 100 51 91 C56 99 63 106 63 114 C63 121 58 126 50 126 Z';

const LAYERS = [
  { path: OUTER_FLAME, period: 440, amp: 0.04 },
  { path: MID_FLAME, period: 360, amp: 0.05 },
  { path: INNER_FLAME, period: 300, amp: 0.07 },
  { path: CORE_FLAME, period: 250, amp: 0.09 },
];

/** Outside → core. */
export const FLAME_COLORS = ['#FF4F1F', '#FF9B2F', '#FFD84D', '#FFF7CC'] as const;
/** The same flame, unlit. */
export const FLAME_COLORS_UNLIT = ['#2E2E34', '#38383F', '#43434B', '#4E4E57'] as const;

function FlameLayer({ path, color, period, amp, width, flicker }: {
  path: string;
  color: string;
  period: number;
  amp: number;
  width: number;
  flicker: boolean;
}) {
  const flick = useSharedValue(0);

  useEffect(() => {
    if (!flicker) return;
    flick.value = withRepeat(
      withSequence(
        withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: period * 0.7, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.8, { duration: period * 0.6, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: period * 0.9, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [flick, period, flicker]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { scaleY: 1 + amp * flick.value },
      { scaleX: 1 - amp * 0.45 * flick.value },
      { rotate: `${(flick.value - 0.5) * 4}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.layer, style]}>
      <Svg width={width} height={width * FLAME_ASPECT} viewBox="0 0 100 130">
        <Path d={path} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The flame's four layers, filling its parent (which should be
 * `width × width * FLAME_ASPECT`).
 */
export function StreakFlame({
  width,
  colors = FLAME_COLORS,
  flicker = true,
}: {
  width: number;
  colors?: readonly string[];
  /** Defaults to true; an unlit flame looks better still. */
  flicker?: boolean;
}) {
  return (
    <>
      {LAYERS.map((layer, i) => (
        <FlameLayer key={i} {...layer} color={colors[i]} width={width} flicker={flicker} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: 'bottom',
  },
});
