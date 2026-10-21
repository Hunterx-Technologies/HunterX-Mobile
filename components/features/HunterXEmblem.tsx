import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Image, Animated } from 'react-native';

const HUNTER_REWARD_GEM = require('../../assets/images/hunterx_reward_emblem.webp');

export interface HunterXEmblemProps {
  size?: number;
  glow?: boolean;
  glowColor?: string;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

export const HunterXEmblem: React.FC<HunterXEmblemProps> = ({
  size = 130,
  glow = true,
  glowColor = '#F66F28',
  style,
  animated = true,
}) => {
  const width = size;
  const height = Math.round(size * (502 / 512));

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated || !glow) return;

    // Subtle breathing pulse on the aura
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );

    // Subtle hovering float
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -3,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 3,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    floatLoop.start();

    return () => {
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [animated, glow]);

  return (
    <View style={[styles.container, { width, height }, style]}>
      {/* Ambient Radial Back Glow */}
      {glow && (
        <Animated.View
          style={[
            styles.glowAura,
            {
              width: width * 0.85,
              height: height * 0.85,
              backgroundColor: glowColor,
              transform: [{ scale: pulseAnim }],
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Floating Elemental Mana Core Gem */}
      <Animated.View
        style={[
          styles.imageContainer,
          {
            width,
            height,
            transform: [{ translateY: animated ? floatAnim : 0 }],
          },
        ]}
        pointerEvents="none"
      >
        <Image
          source={HUNTER_REWARD_GEM}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

export const HunterXLogo = HunterXEmblem;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowAura: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.16,
    shadowColor: '#F66F28',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
