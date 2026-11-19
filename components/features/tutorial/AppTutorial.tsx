import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, RadialGradient, Rect, Stop, Circle } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { fontFamilies } from '@/theme/typography';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  measureTutorialTarget,
  tutorialScroll,
  useTutorialStore,
  type TutorialRect,
} from '@/store/useTutorialStore';
import { TUTORIAL_STEPS, type TutorialScreen } from './tutorialSteps';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const ORANGE = '#FE5B01';
const DIM = 'rgba(3, 3, 5, 0.80)';
const GAP = 16; // between the spotlight and the card
const DEFAULT_PADDING = 8;
const DEFAULT_RADIUS = 16;
// Matches the tab bar in app/(tabs)/_layout.tsx (64 + bottom inset).
const TAB_BAR_HEIGHT = 64;
// One motion for the spotlight and the card, close to a native scroll's.
const MOVE = { duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const TEXT_OUT_MS = 110;
const ROUTES = {
  home: '/(tabs)',
  metrics: '/(tabs)/metrics',
  battles: '/(tabs)/leaderboard',
  profile: '/(tabs)/profile',
} as const;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sameRect = (a: TutorialRect, b: TutorialRect) =>
  Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/**
 * First-visit app tour: dims the app, cuts a glowing spotlight around one
 * element at a time and explains it on a glass card. Mounted once in the root
 * layout (above the tab bar); started from Home by useTutorialStore.start().
 * A plain absolute overlay rather than a <Modal>, so the spotlight measures in
 * the same window coordinates as the views it points at on both platforms.
 * All motion runs on the UI thread (Reanimated), and the card stays up between
 * steps: only its text crossfades while it glides to the next spot.
 */
export function AppTutorial() {
  const active = useTutorialStore((s) => s.active);
  return active ? <TutorialOverlay /> : null;
}

type Shown = { index: number; hole: TutorialRect | null };

function TutorialOverlay() {
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The step on the card and its padded spotlight (null hole = centred card).
  // It lags stepIndex while the next step's target is being found.
  const [shown, setShown] = useState<Shown | null>(null);
  const [cardHeight, setCardHeight] = useState(240);
  const shownIndex = shown?.index ?? stepIndex;
  const step = TUTORIAL_STEPS[shownIndex];
  const isFirst = shownIndex === 0;
  const isLast = shownIndex === TUTORIAL_STEPS.length - 1;

  const overlay = useSharedValue(0);
  const cardVisible = useSharedValue(0);
  const cardY = useSharedValue(0);
  const text = useSharedValue(0);
  const pulse = useSharedValue(0);
  const hx = useSharedValue(W / 2);
  const hy = useSharedValue(H / 2);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const hr = useSharedValue(DEFAULT_RADIUS);

  // The tab the tour last moved to (it starts on Home), and which way the
  // user is going (a step whose target can't be found is skipped that way).
  const screenRef = useRef<Exclude<TutorialScreen, 'any'>>('home');
  const directionRef = useRef<1 | -1>(1);
  const prevHoleRef = useRef<TutorialRect | null>(null);
  const readyRef = useRef(false);
  const closingRef = useRef(false);
  const cardPlacedRef = useRef(false);
  // The overlay's own top-left in measureInWindow's coordinates. On Android
  // those can leave out the status bar while this overlay starts under it, so
  // targets are placed relative to the overlay, not the window.
  const rootRef = useRef<View>(null);
  const measureOrigin = () =>
    new Promise<{ x: number; y: number }>((resolve) => {
      const root = rootRef.current;
      if (!root) return resolve({ x: 0, y: 0 });
      root.measureInWindow((x, y) => resolve({ x: x || 0, y: y || 0 }));
    });

  useEffect(() => {
    overlay.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [overlay, pulse]);

  const moveSpotlight = useCallback(
    (to: TutorialRect | null, radius: number, timing = MOVE) => {
      const prev = prevHoleRef.current;
      if (to) {
        // From a centred card, the spotlight opens out of the target's centre.
        if (!prev) {
          hx.value = to.x + to.width / 2;
          hy.value = to.y + to.height / 2;
          hw.value = 0;
          hh.value = 0;
        }
        hx.value = withTiming(to.x, timing);
        hy.value = withTiming(to.y, timing);
        hw.value = withTiming(to.width, timing);
        hh.value = withTiming(to.height, timing);
        hr.value = withTiming(radius, timing);
      } else if (prev) {
        // Back to a centred card: close the spotlight into its centre.
        hx.value = withTiming(prev.x + prev.width / 2, timing);
        hy.value = withTiming(prev.y + prev.height / 2, timing);
        hw.value = withTiming(0, timing);
        hh.value = withTiming(0, timing);
      }
      prevHoleRef.current = to;
    },
    [hx, hy, hw, hh, hr]
  );

  // Each step: fade the card's text out while the next target is found (and
  // Home scrolls to it), glide the spotlight and card there, fade text in.
  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    const textOut = cardPlacedRef.current
      ? ((text.value = withTiming(0, { duration: TEXT_OUT_MS })), wait(TEXT_OUT_MS))
      : Promise.resolve();
    const s = TUTORIAL_STEPS[stepIndex];

    (async () => {
      // Move to the step's tab. No fixed wait: the target is polled until
      // the new tab has laid it out (same place twice in a row).
      let switched = false;
      if (s.screen !== 'any' && screenRef.current !== s.screen) {
        screenRef.current = s.screen;
        router.navigate(ROUTES[s.screen]);
        switched = true;
      }

      let rect: TutorialRect | null = null;
      let scrolled = false;
      if (s.target) {
        let last: TutorialRect | null = null;
        for (let i = 0; i < 40 && !cancelled; i++) {
          const r = await measureTutorialTarget(s.target);
          if (r && (!switched || (last && sameRect(r, last)))) {
            rect = r;
            break;
          }
          last = r;
          await wait(50);
        }
        // Home and Profile scroll; bring the section into the part of the
        // screen above the tab bar, about a third of the way down. The
        // spotlight heads for where it will land, moving with the scroll.
        // Tab-bar targets are always on screen: never scroll the page for one.
        if (rect && !s.target.startsWith('tab-') && (s.screen === 'home' || s.screen === 'profile')) {
          const minY = insets.top + 12;
          const maxY = H - (TAB_BAR_HEIGHT + insets.bottom) - 12;
          if (rect.y < minY || rect.y + rect.height > maxY) {
            const dy = tutorialScroll(s.screen).by(rect.y - H * 0.3);
            if (Math.abs(dy) > 0.5) {
              rect = { ...rect, y: rect.y - dy };
              scrolled = true;
            }
          }
        }
      } else if (s.screen === 'home') {
        tutorialScroll('home').toTop();
      }
      if (cancelled) return;

      if (s.target && !rect) {
        // Not on screen (e.g. still loading): skip it rather than point at nothing.
        const store = useTutorialStore.getState();
        if (directionRef.current === -1 && stepIndex > 0) store.back();
        else store.next();
        return;
      }

      const pad = s.padding ?? DEFAULT_PADDING;
      const radius = s.radius ?? DEFAULT_RADIUS;
      const origin = rect ? await measureOrigin() : { x: 0, y: 0 };
      if (cancelled) return;
      const toHole = (r: TutorialRect) => ({
        x: r.x - origin.x - pad,
        y: r.y - origin.y - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      });
      const padded = rect ? toHole(rect) : null;

      moveSpotlight(padded, radius);
      await textOut;
      if (cancelled) return;
      setShown({ index: stepIndex, hole: padded });
      readyRef.current = true;

      // After a scroll, check where the target really ended up and nudge.
      if (scrolled && s.target) {
        await wait(MOVE.duration + 40);
        if (cancelled) return;
        const settled = await measureTutorialTarget(s.target);
        if (cancelled || !settled || !padded) return;
        const exact = toHole(settled);
        if (!sameRect(exact, padded)) {
          moveSpotlight(exact, radius, { duration: 180, easing: MOVE.easing });
          setShown({ index: stepIndex, hole: exact });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-runs per step only; geometry is read fresh inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Card placement: under the spotlight if it fits, otherwise above it.
  const hole = shown?.hole ?? null;
  const cardWidth = Math.min(W - 32, 380);
  const cardLeft = (W - cardWidth) / 2;
  let cardTop: number;
  if (!hole) {
    cardTop = (H - cardHeight) / 2;
  } else {
    const below = hole.y + hole.height + GAP;
    const bottomLimit = H - insets.bottom - 16;
    cardTop =
      below + cardHeight <= bottomLimit
        ? below
        : Math.max(insets.top + 16, hole.y - GAP - cardHeight);
  }

  // Glide the card to its spot (it appears in place the first time).
  useEffect(() => {
    if (!shown) return;
    if (!cardPlacedRef.current) {
      cardPlacedRef.current = true;
      cardY.value = cardTop;
      cardVisible.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    } else {
      cardY.value = withTiming(cardTop, MOVE);
    }
  }, [shown, cardTop, cardY, cardVisible]);

  // New step's text fades in once it's on the card.
  useEffect(() => {
    if (shown) text.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [shown?.index, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = useCallback(() => {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
  }, [hapticsEnabled]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (screenRef.current !== 'home') {
      screenRef.current = 'home';
      router.navigate('/(tabs)');
    }
    overlay.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
    setTimeout(() => useTutorialStore.getState().finish(), 230);
  }, [overlay]);

  const onNext = useCallback(() => {
    if (!readyRef.current) return;
    tap();
    directionRef.current = 1;
    if (isLast) close();
    else useTutorialStore.getState().next();
  }, [tap, isLast, close]);

  const onBack = useCallback(() => {
    if (!readyRef.current) return;
    tap();
    directionRef.current = -1;
    useTutorialStore.getState().back();
  }, [tap]);

  const onCardLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h !== cardHeight) setCardHeight(h);
  };

  const rootStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
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
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardVisible.value,
    transform: [{ translateY: cardY.value }, { scale: 0.96 + cardVisible.value * 0.04 }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: text.value,
    transform: [{ translateY: (1 - text.value) * 6 }],
  }));

  return (
    <Animated.View
      ref={rootRef}
      collapsable={false}
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      // Swallows every touch so the app underneath can't be used mid-tour.
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal
    >
      {/* Dim layer with the spotlight cut out */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="tourSpotlight" x={0} y={0} width={W} height={H} maskUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={W} height={H} fill="#FFFFFF" />
            <AnimatedRect animatedProps={spotlightProps} fill="#000000" />
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={DIM} mask="url(#tourSpotlight)" />
      </Svg>

      {/* Glowing ring around the spotlight, with a soft pulse */}
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.ringPulse, pulseStyle]} />
      </Animated.View>

      {/* Glass card */}
      <Animated.View
        onLayout={onCardLayout}
        pointerEvents={shown ? 'auto' : 'none'}
        style={[styles.cardShadow, { top: 0, left: cardLeft, width: cardWidth }, cardStyle]}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.03)', 'rgba(254,91,1,0.07)']}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Soft orange glow in the corner */}
          <Svg width={220} height={220} style={styles.glow} pointerEvents="none">
            <Defs>
              <RadialGradient id="tourGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={ORANGE} stopOpacity={0.32} />
                <Stop offset="1" stopColor={ORANGE} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={110} cy={110} r={110} fill="url(#tourGlow)" />
          </Svg>
          {/* Glass edge highlight */}
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.highlight}
          />

          <Animated.View style={textStyle}>
            <View style={styles.headerRow}>
              <LinearGradient
                colors={['#FF7A2F', ORANGE, '#B83E00']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.iconChip}
              >
                <Ionicons name={step.icon} size={18} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.eyebrow} numberOfLines={1}>
                {step.eyebrow}
              </Text>
              <View style={styles.counterPill}>
                <Text style={styles.counterText}>
                  {shownIndex + 1}
                  <Text style={styles.counterTotal}> / {TUTORIAL_STEPS.length}</Text>
                </Text>
              </View>
            </View>

            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </Animated.View>

          <View style={styles.dotsRow}>
            {TUTORIAL_STEPS.map((s, i) => (
              <View
                key={s.id}
                style={[styles.dot, i === shownIndex && styles.dotActive, i < shownIndex && styles.dotDone]}
              />
            ))}
          </View>

          <View style={styles.actionsRow}>
            {!isLast ? (
              <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip tour">
                <Text style={styles.skipText}>Skip tour</Text>
              </Pressable>
            ) : (
              <View />
            )}

            <View style={styles.actionsRight}>
              {!isFirst && !isLast ? (
                <Pressable
                  onPress={onBack}
                  style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous step"
                >
                  <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={onNext}
                style={({ pressed }) => [pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={isLast ? 'Finish tour' : 'Next step'}
              >
                <LinearGradient
                  colors={['#FF7A2F', ORANGE, '#C44100']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.nextBtn}
                >
                  <Text style={styles.nextText}>{isFirst ? 'Start tour' : isLast ? "Let's go" : 'Next'}</Text>
                  <Ionicons name={isLast ? 'flash' : 'arrow-forward'} size={15} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // No zIndex: mount order in app/_layout.tsx keeps it above the app and the
  // tab bar, but below the offline notice and the force-update gate.
  root: {},
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(254, 91, 1, 0.95)',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  ringPulse: {
    borderWidth: 2,
    borderColor: ORANGE,
  },
  cardShadow: {
    position: 'absolute',
    borderRadius: 24,
    // iOS only: an Android elevation shadow shows through a translucent card.
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.55,
        shadowRadius: 28,
      },
      default: {},
    }),
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
    // Nearly opaque: with no real blur, anything more see-through lets the
    // app's text show through the card's text.
    backgroundColor: 'rgba(16, 16, 20, 0.96)',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  glow: {
    position: 'absolute',
    top: -110,
    right: -90,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  eyebrow: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 11.5,
    letterSpacing: 1.6,
    color: '#FF8A4C',
  },
  counterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  counterText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  counterTotal: {
    fontFamily: fontFamilies.medium,
    color: '#71717A',
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 21,
    lineHeight: 27,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#B4B4BD',
    marginTop: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 18,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  dotDone: {
    backgroundColor: 'rgba(254, 91, 1, 0.45)',
  },
  dotActive: {
    width: 20,
    backgroundColor: ORANGE,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skipText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13.5,
    color: '#8D8D96',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  nextText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
