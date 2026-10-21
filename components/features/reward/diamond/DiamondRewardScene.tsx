import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Canvas,
  Group,
  Paragraph,
  Picture,
  Skia,
  TextAlign,
  createPicture,
  useClock,
  useFonts,
  type SkParagraph,
} from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts as usePoppinsCss } from 'expo-font';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';

import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH, buildFrame } from './diamondSceneEngine';
import { drawCommandsSkia } from './drawSkia';

// Diamond reward screen recreated from the Rive file "Mobile App Diamond
// Reward Screen Animation" (artboard UI, 402x874). The artwork and motion come
// from the exported scene data; the text is real, editable text laid out on
// the design's measured baselines.

export interface DiamondRewardSceneProps {
  eyebrow?: string;
  /** Use "\n" for line breaks; lines sit 34pt apart like the design. */
  title?: string;
  rewardName?: string;
  /** Use "\n" for line breaks; lines sit 20pt apart like the design. */
  description?: string;
  buttonLabel?: string;
  onClose?: () => void;
  onPress?: () => void;
  /**
   * Replaces the center diamond. Gets the box size in screen pixels and plays
   * the diamond's pop-in and float on whatever it returns.
   */
  renderCenter?: (size: { width: number; height: number }) => ReactNode;
  /** Holds the center content back until true, e.g. while its sound loads. Defaults to true. */
  centerReady?: boolean;
  /** Called as the center content starts its pop-in, to sync a sound with it. */
  onCenterAppear?: () => void;
  /** Leaves out the center diamond (implied by `renderCenter`). */
  hideDiamond?: boolean;
  /**
   * Extra content laid out in artboard units (402x874), drawn above the scene
   * and below the buttons. `topShift` is how far the top text moved up.
   */
  renderOverlay?: (info: { topShift: number }) => ReactNode;
}

type TextSpec = {
  key: keyof Pick<DiamondRewardSceneProps, 'eyebrow' | 'title' | 'rewardName' | 'description' | 'buttonLabel'>;
  weight: 500 | 600;
  size: number;
  letterSpacing: number;
  lineGap: number;
  color: string;
  /** Baseline of the first line, artboard units. */
  baseline: number;
  /** Moves up with the close button to the top of the screen. */
  top?: boolean;
};

// Measured from the outlined text in the Rive file (Poppins).
const TEXT: TextSpec[] = [
  { key: 'eyebrow', weight: 500, size: 15, letterSpacing: -0.5, lineGap: 20, color: 'rgba(255,255,255,0.6)', baseline: 143, top: true },
  { key: 'title', weight: 600, size: 28, letterSpacing: -0.5, lineGap: 34, color: '#FFFFFF', baseline: 183, top: true },
  { key: 'rewardName', weight: 600, size: 22, letterSpacing: -0.45, lineGap: 28, color: '#FFFFFF', baseline: 651 },
  { key: 'description', weight: 500, size: 15, letterSpacing: -0.23, lineGap: 20, color: 'rgba(255,255,255,0.7)', baseline: 679 },
  { key: 'buttonLabel', weight: 600, size: 17, letterSpacing: -0.43, lineGap: 22, color: '#FFFFFF', baseline: 789 },
];

const DEFAULTS: Required<Pick<DiamondRewardSceneProps, TextSpec['key']>> = {
  eyebrow: 'Congratulations!',
  title: 'You’ve Earned a\nDiamond Reward!',
  rewardName: 'Diamond XP Boost',
  description: 'Come back tomorrow to unlock even rarer\nrewards and climb the leaderboard!',
  buttonLabel: 'Got it!',
};

const CENTER_X = 201;
const TEXT_BOX_WIDTH = 370;
// Tap areas (artboard units): the close circle and the "Got it!" button.
// Box for custom center content (artboard units): between the title and the
// reward name, centered on the diamond's axis.
const CENTER_BOX = { x: 91, y: 236, w: 220, h: 339 };
// The diamond's float travel, scaled down so the content clears the text.
const CENTER_FLOAT = 12;
const RIVE_EASE = Easing.bezier(0.42, 0, 0.58, 1);
const riveEase = Easing.bezierFn(0.42, 0, 0.58, 1);

const CLOSE_HIT = { x: 16, y: 70, w: 34, h: 34 };
// Screen points between the safe area top and the close button.
const TOP_GAP = 8;
const BUTTON_HIT = { x: 16, y: 758, w: 370, h: 50 };

// Background gradient stops of the artboard, for areas outside the artboard on
// screens taller or wider than 402:874.
const BG_COLORS = ['#020203', '#020203', '#3A1408', '#8A2410'] as const;
const BG_STOPS = [0, 0.0293, 0.6993, 1] as const;

const POPPINS = {
  500: require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
  600: require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
};

function useLayout() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const scale = size.w && size.h ? Math.min(size.w / ARTBOARD_WIDTH, size.h / ARTBOARD_HEIGHT) : 0;
  const ox = (size.w - ARTBOARD_WIDTH * scale) / 2;
  const oy = (size.h - ARTBOARD_HEIGHT * scale) / 2;
  return { size, scale, ox, oy, onLayout };
}

type SceneProps = {
  scale: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
  texts: Record<string, string>;
  hideDiamond: boolean;
  /** Artboard units the close button and top text move up by. */
  topShift: number;
};

// Same motion as the diamond in the Rive file: pops in from below while
// scaling 1 -> 1.2 -> 1 and fading in (0.5s), then floats up and down every 2s.
const AnimatedCenter: React.FC<{ scale: number; onAppear?: () => void; children: ReactNode }> = ({
  scale,
  onAppear,
  children,
}) => {
  const pop = useSharedValue(0); // 0 start, 1 overshoot, 2 settled
  const float = useSharedValue(0);

  useEffect(() => {
    onAppear?.();
    pop.value = withSequence(
      withTiming(1, { duration: 333, easing: Easing.linear }),
      withTiming(2, { duration: 167, easing: Easing.linear })
    );
    float.value = withRepeat(withTiming(1, { duration: 1000, easing: RIVE_EASE }), -1, true);
  }, [pop, float]);

  const style = useAnimatedStyle(() => {
    const p = pop.value;
    const first = p <= 1;
    const u = first ? p : p - 1;
    const e = riveEase(u);
    const s = first ? 1 + 0.2 * e : 1.2 - 0.2 * e;
    const opacity = Math.min(1, first ? 1.2 * e : 1.2 - 0.2 * e);
    const lift = first ? 74.5 - 60 * u : 14.5 - 14.5 * u;
    return {
      opacity,
      transform: [{ translateY: (lift + CENTER_FLOAT * float.value) * scale }, { scale: s }],
    };
  });

  return <Animated.View style={[StyleSheet.absoluteFill, styles.center, style]}>{children}</Animated.View>;
};

const NativeScene: React.FC<SceneProps> = ({ scale, ox, oy, w, h, texts, hideDiamond, topShift }) => {
  const clock = useClock();
  const fonts = useFonts({ Poppins: [POPPINS[500], POPPINS[600]] });

  const picture = useDerivedValue(() => {
    const cmds = buildFrame(clock.value / 1000, hideDiamond, topShift);
    return createPicture(
      (canvas) => {
        canvas.translate(ox, oy);
        canvas.scale(scale, scale);
        drawCommandsSkia(canvas, cmds);
      },
      { width: w, height: h }
    );
  });

  const paragraphs = useMemo(() => {
    if (!fonts) return [];
    const out: { p: SkParagraph; x: number; y: number }[] = [];
    for (const spec of TEXT) {
      const text = texts[spec.key];
      if (!text) continue;
      const p = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center }, fonts)
        .pushStyle({
          color: Skia.Color(spec.color),
          fontFamilies: ['Poppins'],
          fontSize: spec.size,
          fontStyle: { weight: spec.weight },
          letterSpacing: spec.letterSpacing,
          heightMultiplier: spec.lineGap / spec.size,
        })
        .addText(text)
        .pop()
        .build();
      p.layout(TEXT_BOX_WIDTH);
      const first = p.getLineMetrics()[0];
      out.push({ p, x: CENTER_X - TEXT_BOX_WIDTH / 2, y: spec.baseline - (spec.top ? topShift : 0) - (first ? first.baseline : 0) });
    }
    return out;
  }, [fonts, texts, topShift]);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
      <Group transform={[{ translateX: ox }, { translateY: oy }, { scale }]}>
        {paragraphs.map((item, i) => (
          <Paragraph key={i} paragraph={item.p} x={item.x} y={item.y} width={TEXT_BOX_WIDTH} />
        ))}
      </Group>
    </Canvas>
  );
};

// Web: react-native-skia needs CanvasKit there (not loaded in this app), so the
// same scene is drawn on a 2D canvas.
const WebScene: React.FC<SceneProps> = ({ scale, ox, oy, w, h, texts, hideDiamond, topShift }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Canvas text needs the fonts registered as CSS font faces.
  const [fontsReady] = usePoppinsCss({ Poppins_500Medium, Poppins_600SemiBold });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Loaded lazily so native bundles never touch the DOM renderer.
    const { drawCommands } = require('./drawCanvas2d') as typeof import('./drawCanvas2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const base = [dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy];
    const start = performance.now();
    let frame = 0;
    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCommands(ctx, buildFrame((performance.now() - start) / 1000, hideDiamond, topShift), base);
      ctx.setTransform(base[0], 0, 0, base[3], base[4], base[5]);
      ctx.textAlign = 'center';
      for (const spec of fontsReady ? TEXT : []) {
        const text = texts[spec.key];
        if (!text) continue;
        ctx.font = `${spec.size}px ${spec.weight === 600 ? 'Poppins_600SemiBold' : 'Poppins_500Medium'}`;
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spec.letterSpacing}px`;
        ctx.fillStyle = spec.color;
        // Canvas adds the spacing after every glyph, including the last one.
        text.split('\n').forEach((line, i) => ctx.fillText(line, CENTER_X - spec.letterSpacing / 2, spec.baseline - (spec.top ? topShift : 0) + i * spec.lineGap));
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [scale, ox, oy, w, h, texts, fontsReady, hideDiamond, topShift]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} />;
};

export const DiamondRewardScene: React.FC<DiamondRewardSceneProps> = (props) => {
  const { size, scale, ox, oy, onLayout } = useLayout();
  const insets = useSafeAreaInsets();
  const hideDiamond = !!props.renderCenter || !!props.hideDiamond;
  // The design leaves room for a mock status bar; lift the close button and
  // the top text to just below the device's real one.
  const topShift = scale > 0 ? Math.min(CLOSE_HIT.y, Math.max(0, CLOSE_HIT.y - (insets.top + TOP_GAP - oy) / scale)) : 0;
  const texts = useMemo(
    () => ({
      eyebrow: props.eyebrow ?? DEFAULTS.eyebrow,
      title: props.title ?? DEFAULTS.title,
      rewardName: props.rewardName ?? DEFAULTS.rewardName,
      description: props.description ?? DEFAULTS.description,
      buttonLabel: props.buttonLabel ?? DEFAULTS.buttonLabel,
    }),
    [props.eyebrow, props.title, props.rewardName, props.description, props.buttonLabel]
  );

  const hit = (r: { x: number; y: number; w: number; h: number }) => ({
    position: 'absolute' as const,
    left: ox + r.x * scale,
    top: oy + r.y * scale,
    width: r.w * scale,
    height: r.h * scale,
  });

  return (
    <View style={styles.root} onLayout={onLayout}>
      <LinearGradient colors={BG_COLORS} locations={BG_STOPS} style={StyleSheet.absoluteFill} />
      {scale > 0 &&
        (Platform.OS === 'web' ? (
          <WebScene scale={scale} ox={ox} oy={oy} w={size.w} h={size.h} texts={texts} hideDiamond={hideDiamond} topShift={topShift} />
        ) : (
          <NativeScene scale={scale} ox={ox} oy={oy} w={size.w} h={size.h} texts={texts} hideDiamond={hideDiamond} topShift={topShift} />
        ))}
      {scale > 0 && props.renderOverlay && (
        <View
          pointerEvents="none"
          style={[styles.overlay, { left: ox, top: oy, transform: [{ scale }] }]}
        >
          {props.renderOverlay({ topShift })}
        </View>
      )}
      {scale > 0 && props.renderCenter && props.centerReady !== false && (
        <View style={hit(CENTER_BOX)}>
          <AnimatedCenter scale={scale} onAppear={props.onCenterAppear}>
            {props.renderCenter({ width: CENTER_BOX.w * scale, height: CENTER_BOX.h * scale })}
          </AnimatedCenter>
        </View>
      )}
      {scale > 0 && (
        <>
          <Pressable
            style={hit({ ...CLOSE_HIT, y: CLOSE_HIT.y - topShift })}
            onPress={props.onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <Pressable
            style={hit(BUTTON_HIT)}
            onPress={props.onPress}
            accessibilityRole="button"
            accessibilityLabel={texts.buttonLabel}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020203',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    transformOrigin: 'top left',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
