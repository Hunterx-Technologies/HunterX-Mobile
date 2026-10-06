import React, { useEffect, useRef } from 'react';
import { StyleSheet, Image, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

export interface HunterXSplashProps {
  onAnimationComplete?: () => void;
  isReady?: boolean;
  logoSource?: any;
}

export const HunterXSplash: React.FC<HunterXSplashProps> = ({
  onAnimationComplete,
  logoSource = require('@/assets/images/app_logo_clean.png'),
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const containerOpacity = useSharedValue(1);
  const hasFinished = useRef(false);

  // Logo height: ~34% of screen height
  const logoHeight = Math.min(screenHeight * 0.34, screenWidth * 0.78);
  const logoWidth = logoHeight * (496 / 506);

  const handleFinish = () => {
    if (onAnimationComplete) {
      onAnimationComplete();
    }
  };

  useEffect(() => {
    // Static hold for 2 seconds, then quick fade out to reveal login screen
    const timer = setTimeout(() => {
      containerOpacity.value = withTiming(
        0,
        {
          duration: 250,
          easing: Easing.out(Easing.quad),
        },
        (finished) => {
          if (finished && !hasFinished.current) {
            hasFinished.current = true;
            runOnJS(handleFinish)();
          }
        }
      );
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: containerOpacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
      ]}
      pointerEvents={hasFinished.current ? 'none' : 'auto'}
    >
      <Image
        source={logoSource}
        style={{
          width: logoWidth,
          height: logoHeight,
        }}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#030406',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
    elevation: 999999,
  },
});

export default HunterXSplash;
