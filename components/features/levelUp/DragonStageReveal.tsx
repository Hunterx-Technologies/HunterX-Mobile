import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

// Shown after the level-up screen on a rank up: the new dragon stage's art,
// its name and message, then the bottom button. Same backdrop and white
// button as the level-up screen. All text comes from the API.

// Same gradient as the reward / level-up scene.
const BG_COLORS = ['#020203', '#020203', '#3A1408', '#8A2410'] as const;
const BG_STOPS = [0, 0.0293, 0.6993, 1] as const;

export interface DragonStageRevealProps {
  visible: boolean;
  imageUrl: string;
  name: string;
  message: string;
  buttonLabel: string;
  onDone: () => void;
}

export function DragonStageReveal({ visible, imageUrl, name, message, buttonLabel, onDone }: DragonStageRevealProps) {
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [visible, appear]);

  const imageStyle = {
    opacity: appear,
    transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  };
  const textStyle = {
    opacity: appear,
    transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={onDone}>
      <LinearGradient colors={BG_COLORS} locations={BG_STOPS} style={styles.screen}>
        <View style={styles.center}>
          <Animated.View style={[styles.imageWrap, imageStyle]}>
            <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" transition={200} />
          </Animated.View>
          <Animated.View style={[styles.textBlock, textStyle]}>
            {!!name && <Text style={styles.name}>{name}</Text>}
            {!!message && <Text style={styles.message}>{message}</Text>}
          </Animated.View>
        </View>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={onDone}>
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </Pressable>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  imageWrap: {
    width: '80%',
    aspectRatio: 1,
    maxWidth: 340,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  name: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 34,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  button: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
    color: '#0D0F12',
  },
});
