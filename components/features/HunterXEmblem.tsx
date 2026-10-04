import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  G,
} from 'react-native-svg';

export interface HunterXEmblemProps {
  size?: number;
  glow?: boolean;
  glowColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const HunterXEmblem: React.FC<HunterXEmblemProps> = ({
  size = 80,
  glow = true,
  glowColor = '#F66F28',
  style,
}) => {
  const width = size;
  const height = size;

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Svg width={width} height={height} viewBox="0 0 100 100" fill="none">
        <Defs>
          {/* Subtle localized back aura (tightly contained) */}
          <RadialGradient id="xBackAura" cx="50%" cy="50%" r="42%">
            <Stop offset="0%" stopColor={glowColor} stopOpacity="0.22" />
            <Stop offset="60%" stopColor="#B94F24" stopOpacity="0.05" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>

          {/* Top-Left Wing Upper Chamfer Highlight */}
          <LinearGradient id="gradWingHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFAC66" />
            <Stop offset="40%" stopColor="#FF9438" />
            <Stop offset="100%" stopColor="#F66F28" />
          </LinearGradient>

          {/* Top-Left Wing Body */}
          <LinearGradient id="gradWingBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#F66F28" />
            <Stop offset="50%" stopColor="#DF5714" />
            <Stop offset="100%" stopColor="#9E350A" />
          </LinearGradient>

          {/* Main Diagonal Upper Lit Face */}
          <LinearGradient id="gradMainSlash" x1="100%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFAA66" />
            <Stop offset="25%" stopColor="#F66F28" />
            <Stop offset="65%" stopColor="#E05A18" />
            <Stop offset="100%" stopColor="#A6380A" />
          </LinearGradient>

          {/* Main Diagonal Lower Shadow Face */}
          <LinearGradient id="gradSlashShadow" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#E05A18" />
            <Stop offset="50%" stopColor="#B94F24" />
            <Stop offset="100%" stopColor="#692005" />
          </LinearGradient>

          {/* Bottom-Right Foot Shadow */}
          <LinearGradient id="gradFootShadow" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#B94F24" />
            <Stop offset="50%" stopColor="#8A2E07" />
            <Stop offset="100%" stopColor="#4D1602" />
          </LinearGradient>
        </Defs>

        {/* Tight Ambient Glow behind emblem only */}
        {glow && (
          <Path
            d="M 5 5 L 95 5 L 95 95 L 5 95 Z"
            fill="url(#xBackAura)"
          />
        )}

        <G>
          {/* ========================================================== */}
          {/* 1. TOP-LEFT WING (Chamfer & Horn)                          */}
          {/* ========================================================== */}
          <Path
            d="M 16 28 L 38 30 L 47 43 L 32 36 Z"
            fill="url(#gradWingHighlight)"
          />
          <Path
            d="M 16 28 L 32 36 L 47 43 L 37 55 L 28 38 Z"
            fill="url(#gradWingBody)"
          />

          {/* ========================================================== */}
          {/* 2. BOTTOM-RIGHT FOOT (Angled upward cut at bottom)         */}
          {/* ========================================================== */}
          <Path
            d="M 54 55 L 80 80 L 58 78 L 48 66 Z"
            fill="url(#gradFootShadow)"
          />

          {/* ========================================================== */}
          {/* 3. MAIN DIAGONAL SLASH (Top-Right Needle to Bottom-Left)   */}
          {/* ========================================================== */}
          <Path
            d="M 82 14 L 51 44 L 37 55 L 14 88 L 26 74 L 42 56 L 62 40 Z"
            fill="url(#gradMainSlash)"
          />
          <Path
            d="M 82 14 L 62 40 L 42 56 L 54 55 L 43 74 L 38 76 L 14 88 L 26 74 Z"
            fill="url(#gradSlashShadow)"
          />
        </G>
      </Svg>
    </View>
  );
};

export const HunterXLogo = HunterXEmblem;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
