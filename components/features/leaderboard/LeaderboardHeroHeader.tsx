import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { fontFamilies } from '@/theme/typography';

const LEADERBOARD_HERO_BG = require('@/assets/images/leaderboardone.png');

interface LeaderboardHeroHeaderProps {
  onInfoPress?: () => void;
}

export const LeaderboardHeroHeader: React.FC<LeaderboardHeroHeaderProps> = ({
  onInfoPress,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(tabs)');
    }
  };

  return (
    <View style={styles.headerContainer}>
      {/* Background Graphic: leaderboardone.png covering the hero */}
      <Image
        source={LEADERBOARD_HERO_BG}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Top subtle dark overlay for status bar readability */}
      <LinearGradient
        colors={['rgba(9, 9, 11, 0.75)', 'rgba(9, 9, 11, 0.2)', 'transparent']}
        locations={[0, 0.35, 0.6]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Bottom smooth fade to canvas black */}
      <LinearGradient
        colors={['transparent', 'rgba(9, 9, 11, 0.8)', '#09090B']}
        locations={[0.55, 0.85, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* TOP NAVIGATION BAR */}
      <View style={styles.topNavRow}>
        {/* Left: Clean Back Button (strictly no background/border per project rules) */}
        {router.canGoBack() && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Brand Center/Left */}
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <Text style={styles.brandHunter}>Hunter</Text>
            <Text style={styles.brandX}>X</Text>
          </View>
          <Text style={styles.brandSubtitle}>TRACK. IMPROVE. GO FURTHER.</Text>
        </View>

        {/* Right: Info / Help Question Mark Button */}
        <TouchableOpacity
          style={styles.infoBtn}
          onPress={onInfoPress}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="help-circle-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Slanted red graffiti/brush tagline on left mountain slope */}
      <View style={styles.slantedTaglineBlock} pointerEvents="none">
        <Text style={styles.slantedTaglineText}>SAME</Text>
        <Text style={styles.slantedTaglineText}>GOAL</Text>
        <Text style={styles.slantedTaglineText}>HIGHER</Text>
        <Text style={styles.slantedTaglineText}>HUMANS.</Text>
      </View>

      {/* Creed text on the right side under the moon */}
      <View style={styles.creedCol} pointerEvents="none">
        <Text style={styles.creedText}>DISCIPLINE</Text>
        <Text style={styles.creedText}>BUILDS</Text>
        <Text style={styles.creedText}>FREEDOM</Text>
      </View>

      {/* HERO TITLE SECTION - Big bold "Leaderboard" */}
      <View style={styles.bottomTitleBlock}>
        <Text style={styles.screenMainTitle}>Leaderboard</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    height: 275,
    position: 'relative',
    justifyContent: 'space-between',
    paddingBottom: 6,
    backgroundColor: '#09090B',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  brandBlock: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandHunter: {
    fontFamily: fontFamilies.bold,
    fontSize: 21,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  brandX: {
    fontFamily: fontFamilies.bold,
    fontSize: 21,
    color: '#EF4444',
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 8,
    color: '#9CA3AF',
    letterSpacing: 1.1,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  infoBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slantedTaglineBlock: {
    position: 'absolute',
    left: 20,
    top: 86,
    transform: [{ rotate: '-13deg' }],
    zIndex: 10,
  },
  slantedTaglineText: {
    fontFamily: fontFamilies.brush,
    fontSize: 13.5,
    lineHeight: 16,
    color: '#EF4444',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(239, 68, 68, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  creedCol: {
    position: 'absolute',
    right: 18,
    top: 130,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  creedText: {
    fontFamily: fontFamilies.bold,
    fontSize: 8.5,
    color: '#9CA3AF',
    letterSpacing: 1.1,
    lineHeight: 12.5,
    textTransform: 'uppercase',
  },
  bottomTitleBlock: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    zIndex: 10,
  },
  screenMainTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 32,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
});
