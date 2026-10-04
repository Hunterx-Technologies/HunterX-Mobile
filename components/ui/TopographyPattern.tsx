import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface TopographyPatternProps {
  width: number;
  height: number;
  opacity?: number;
}

export const TopographyPattern: React.FC<TopographyPatternProps> = ({
  width,
  height,
  opacity = 0.9,
}) => {
  return (
    <View
      style={[styles.container, { width, height, opacity }]}
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox="0 0 240 360" fill="none">
        <Defs>
          {/* Pure Charcoal-Grey Topography Lines (Matching Reference) */}
          <LinearGradient id="topoGreyClean" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#2A2C33" stopOpacity="0.85" />
            <Stop offset="50%" stopColor="#212328" stopOpacity="0.7" />
            <Stop offset="100%" stopColor="#181A1E" stopOpacity="0.55" />
          </LinearGradient>

          <LinearGradient id="topoGreySubtle" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#23252A" stopOpacity="0.6" />
            <Stop offset="50%" stopColor="#2A2C33" stopOpacity="0.75" />
            <Stop offset="100%" stopColor="#1A1C20" stopOpacity="0.5" />
          </LinearGradient>
        </Defs>

        {/* Top Left Ridge Lines */}
        <Path
          d="M -20 15 C 20 25, 45 10, 75 35 C 105 60, 95 95, 130 110 C 165 125, 210 100, 260 115"
          stroke="url(#topoGreyClean)"
          strokeWidth="1.1"
        />
        <Path
          d="M -20 35 C 25 45, 50 28, 85 52 C 120 76, 110 112, 145 128 C 180 144, 220 120, 260 135"
          stroke="url(#topoGreyClean)"
          strokeWidth="1"
        />
        <Path
          d="M -15 60 C 30 70, 60 50, 95 72 C 130 94, 125 130, 160 146 C 195 162, 230 140, 260 155"
          stroke="url(#topoGreySubtle)"
          strokeWidth="1"
        />
        <Path
          d="M -10 85 C 35 95, 70 72, 105 92 C 140 112, 140 150, 175 166 C 210 182, 240 160, 260 175"
          stroke="url(#topoGreyClean)"
          strokeWidth="1"
        />

        {/* Center Contour Ring Group */}
        <Path
          d="M 15 130 C 50 140, 80 120, 115 138 C 150 156, 155 190, 190 204 C 225 218, 245 195, 260 210"
          stroke="url(#topoGreySubtle)"
          strokeWidth="1"
        />
        <Path
          d="M -10 160 C 35 170, 75 148, 110 165 C 145 182, 160 215, 195 230 C 230 245, 245 225, 260 240"
          stroke="url(#topoGreyClean)"
          strokeWidth="1"
        />

        {/* Sweeping Center Arc Loops */}
        <Path
          d="M 120 155 C 80 145, 60 180, 85 215 C 110 250, 160 240, 175 205 C 190 170, 160 165, 120 155 Z"
          stroke="url(#topoGreyClean)"
          strokeWidth="1"
        />
        <Path
          d="M 120 140 C 65 130, 45 190, 75 230 C 105 270, 175 260, 190 215 C 205 170, 175 150, 120 140 Z"
          stroke="url(#topoGreySubtle)"
          strokeWidth="1"
        />
        <Path
          d="M 120 125 C 50 115, 30 200, 65 245 C 100 290, 190 280, 205 225 C 220 170, 190 135, 120 125 Z"
          stroke="url(#topoGreyClean)"
          strokeWidth="1"
        />

        {/* Bottom Contour Terraces */}
        <Path
          d="M -20 220 C 20 230, 50 210, 85 235 C 120 260, 130 300, 165 315 C 200 330, 235 305, 260 320"
          stroke="url(#topoGreySubtle)"
          strokeWidth="1"
        />
        <Path
          d="M -20 250 C 25 260, 60 238, 95 260 C 130 282, 145 320, 180 335 C 215 350, 240 325, 260 340"
          stroke="url(#topoGreyClean)"
          strokeWidth="1"
        />
        <Path
          d="M -10 280 C 35 290, 70 268, 105 288 C 140 308, 160 340, 195 355 C 230 370, 245 345, 260 360"
          stroke="url(#topoGreySubtle)"
          strokeWidth="1"
        />
        <Path
          d="M 5 310 C 50 320, 85 295, 120 315 C 155 335, 175 365, 210 380"
          stroke="url(#topoGreyClean)"
          strokeWidth="1"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
