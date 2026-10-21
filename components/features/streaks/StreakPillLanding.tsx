import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useStreakBreakStore } from '@/store/useStreakBreakStore';

/**
 * Wraps the home header's streak pill: pops it with an orange glow when
 * the streak break card's flame lands on it.
 */
export function StreakPillLanding({ children }: { children: React.ReactNode }) {
  const landedAt = useStreakBreakStore((s) => s.pillLandedAt);
  const seen = useRef(landedAt);
  const pop = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (landedAt === null || landedAt === seen.current) return;
    seen.current = landedAt;
    pop.value = withSequence(
      withTiming(1.22, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 8, stiffness: 180 })
    );
    ring.value = 0;
    ring.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
  }, [landedAt, pop, ring]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 1 - ring.value,
    transform: [{ scaleX: 1 + 0.35 * ring.value }, { scaleY: 1 + 0.8 * ring.value }],
  }));

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      <Animated.View style={popStyle}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FF5500',
  },
});
