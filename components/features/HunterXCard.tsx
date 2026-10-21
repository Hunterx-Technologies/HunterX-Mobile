import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { HunterXEmblem } from './HunterXEmblem';
import { TopographyPattern } from '../ui/TopographyPattern';
import { fontFamilies } from '../../theme/typography';

const HUNTERX_TITLE = require('../../assets/images/hunterx_card_title.png');

export interface HunterXCardProps {
  width?: number;
  height?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  showFooter?: boolean;
  footerText?: string;
  isExpired?: boolean;
  emblemSize?: number;
  animateGlow?: boolean;
}

export const HunterXCard: React.FC<HunterXCardProps> = ({
  width = 280,
  height,
  onPress,
  style,
  showFooter = true,
  footerText = 'DRAG TO SCRATCH',
  isExpired = false,
  emblemSize,
  animateGlow = true,
}) => {
  const cardHeight = height || width * 1.54;
  const calculatedEmblemSize = emblemSize || Math.round(width * 0.48);
  const titleWidth = Math.round(width * 0.54);
  const titleHeight = Math.round(titleWidth / 3.30);
  const titleTop = Math.round(cardHeight * 0.07);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animateGlow) return;

    // Subtle breathing pulse for the footer prompt
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Subtle light sweep across the card
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3200,
        useNativeDriver: true,
      })
    );
    shimmerLoop.start();

    return () => {
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, [animateGlow]);

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width * 1.6],
  });

  const CardContent = (
    <View
      style={[
        styles.outerBorderGlow,
        {
          width,
          height: cardHeight,
          borderColor: isExpired ? '#2A2C33' : '#F66F28',
          shadowColor: isExpired ? '#000000' : '#F66F28',
        },
        style,
      ]}
    >
      {/* Grey Card Interior (Matching Reference Screenshot) */}
      <LinearGradient
        colors={['#16181C', '#121316', '#0E0F12']}
        style={styles.cardSurface}
      >
        {/* 1. Charcoal-Grey Topographic Elevation Pattern */}
        <TopographyPattern
          width={width}
          height={cardHeight}
          opacity={isExpired ? 0.35 : 0.9}
        />

        {/* 2. Top Center Stylized "HUNTER X" Title Logo */}
        <View
          style={[
            styles.cardTopTitleContainer,
            {
              top: titleTop,
            },
          ]}
          pointerEvents="none"
        >
          <Image
            source={HUNTERX_TITLE}
            style={[
              styles.cardTopTitle,
              {
                width: titleWidth,
                height: titleHeight,
                opacity: isExpired ? 0.45 : 1,
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* 3. Very Mild, Subtle Orange Perimeter Tint (Top Edge Only) */}
        {!isExpired && (
          <LinearGradient
            colors={['rgba(246, 111, 40, 0.05)', 'transparent']}
            start={{ x: 0.1, y: 0.01 }}
            end={{ x: 0.4, y: 0.25 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        )}

        {/* 4. Subtle Shimmer Highlight */}
        {animateGlow && (
          <Animated.View
            style={[
              styles.shimmerSweep,
              {
                transform: [{ translateX: shimmerTranslateX }, { rotate: '25deg' }],
              },
            ]}
            pointerEvents="none"
          />
        )}

        {/* 5. Center 3D Faceted HunterX Emblem */}
        <View style={styles.centerContainer} pointerEvents="none">
          <HunterXEmblem size={calculatedEmblemSize} glow={!isExpired} />
        </View>

        {/* 5. Bottom "DRAG TO SCRATCH" Footer */}
        {showFooter && (
          <Animated.View
            style={[
              styles.footerPromptRow,
              animateGlow && { transform: [{ scale: pulseAnim }] },
            ]}
            pointerEvents="none"
          >
            <FontAwesome5
              name="hand-pointer"
              size={9.5}
              color={isExpired ? '#777777' : '#F2F2F2'}
              style={styles.handIcon}
            />
            <Text
              style={[
                styles.footerPromptText,
                isExpired && { color: '#777777' },
              ]}
              numberOfLines={1}
            >
              {footerText}
            </Text>
          </Animated.View>
        )}
      </LinearGradient>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return CardContent;
};

const styles = StyleSheet.create({
  outerBorderGlow: {
    borderRadius: 22,
    borderWidth: 1.5,
    backgroundColor: '#16181C',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  cardSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardTopTitleContainer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTopTitle: {},
  shimmerSweep: {
    position: 'absolute',
    top: -80,
    bottom: -80,
    width: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  footerPromptRow: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  handIcon: {
    opacity: 0.9,
  },
  footerPromptText: {
    fontFamily: fontFamilies.semiBold,
    color: '#F2F2F2',
    fontSize: 7.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
