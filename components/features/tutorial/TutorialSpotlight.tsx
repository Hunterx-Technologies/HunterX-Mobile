import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { BlurMask, Canvas, FillType, Path, Skia } from '@shopify/react-native-skia';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

export type SpotlightValues = {
  /** The hole's top-left, size and corner radius, animated on the UI thread. */
  hx: SharedValue<number>;
  hy: SharedValue<number>;
  hw: SharedValue<number>;
  hh: SharedValue<number>;
  hr: SharedValue<number>;
  /** 0..1, loops: drives the ring's soft pulse. */
  pulse: SharedValue<number>;
};

type Props = SpotlightValues & { width: number; height: number; dim: string; color: string };

/**
 * The tour's dimmed backdrop with a rounded spotlight cut out, plus a glowing
 * ring that pulses around it. On phones it's drawn by Skia on the GPU, so the
 * spotlight gliding between steps (and the pulse) never re-rasterises a
 * full-screen SVG mask, which is what made the tour stutter on low-end
 * Android. Web has no Skia (CanvasKit isn't loaded), so it keeps an SVG mask.
 */
export function TutorialSpotlight(props: Props) {
  return Platform.OS === 'web' ? <SvgSpotlight {...props} /> : <SkiaSpotlight {...props} />;
}

const PULSE_GROW = 0.12;
const OVERSHOOT = 400;

function SkiaSpotlight({ hx, hy, hw, hh, hr, pulse, width, height, dim, color }: Props) {
  // Whole screen minus the hole (even-odd), rebuilt per frame on the UI thread.
  // The dim overshoots on every side: on Android the window size can leave out
  // the status bar while the overlay covers it, which left the bottom strip
  // (half the tab bar) undimmed. The canvas clips it to the overlay anyway.
  const dimPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    p.addRect(Skia.XYWHRect(-OVERSHOOT, -OVERSHOOT, width + OVERSHOOT * 2, height + OVERSHOOT * 2));
    if (hw.value > 0.5 && hh.value > 0.5) {
      p.addRRect(Skia.RRectXY(Skia.XYWHRect(hx.value, hy.value, hw.value, hh.value), hr.value, hr.value));
    }
    p.setFillType(FillType.EvenOdd);
    return p;
  });

  const ringPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    p.addRRect(Skia.RRectXY(Skia.XYWHRect(hx.value, hy.value, hw.value, hh.value), hr.value, hr.value));
    return p;
  });

  // The pulse: the ring grows out of its centre and fades.
  const pulsePath = useDerivedValue(() => {
    const s = 1 + pulse.value * PULSE_GROW;
    const w = hw.value * s;
    const h = hh.value * s;
    const p = Skia.Path.Make();
    p.addRRect(
      Skia.RRectXY(
        Skia.XYWHRect(hx.value + hw.value / 2 - w / 2, hy.value + hh.value / 2 - h / 2, w, h),
        hr.value * s,
        hr.value * s
      )
    );
    return p;
  });

  const ringOpacity = useDerivedValue(() => (hw.value > 2 ? 1 : 0));
  const pulseOpacity = useDerivedValue(() => {
    if (hw.value <= 2) return 0;
    const v = pulse.value;
    return v < 0.2 ? (v / 0.2) * 0.7 : 0.7 * (1 - (v - 0.2) / 0.8);
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path path={dimPath} color={dim} />
      {/* Glow, then the crisp ring on top of it */}
      <Path path={ringPath} style="stroke" strokeWidth={4} color={color} opacity={ringOpacity}>
        <BlurMask blur={8} style="normal" />
      </Path>
      <Path path={ringPath} style="stroke" strokeWidth={1.5} color={color} opacity={ringOpacity} />
      <Path path={pulsePath} style="stroke" strokeWidth={2} color={color} opacity={pulseOpacity} />
    </Canvas>
  );
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function SvgSpotlight({ hx, hy, hw, hh, hr, pulse, width: W, height: H, dim, color }: Props) {
  const spotlightProps = useAnimatedProps(() => ({
    x: hx.value,
    y: hy.value,
    width: hw.value,
    height: hh.value,
    rx: hr.value,
    ry: hr.value,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    left: hx.value,
    top: hy.value,
    width: hw.value,
    height: hh.value,
    borderRadius: hr.value,
    opacity: hw.value > 2 ? 1 : 0,
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    borderRadius: hr.value,
    opacity: pulse.value < 0.2 ? (pulse.value / 0.2) * 0.7 : 0.7 * (1 - (pulse.value - 0.2) / 0.8),
    transform: [{ scale: 1 + pulse.value * PULSE_GROW }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="tourSpotlight" x={0} y={0} width={W} height={H} maskUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={W} height={H} fill="#FFFFFF" />
            <AnimatedRect animatedProps={spotlightProps} fill="#000000" />
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={dim} mask="url(#tourSpotlight)" />
      </Svg>
      <Animated.View style={[styles.ring, { borderColor: color, shadowColor: color }, ringStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.ringPulse, { borderColor: color }, pulseStyle]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  ringPulse: {
    borderWidth: 2,
  },
});
