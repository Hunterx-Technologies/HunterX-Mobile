import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { fontFamilies } from '@/theme/typography';

interface LeaderboardTop5HighlightCardProps {
  onPress?: () => void;
  percentile?: string;
  subtitle?: string;
}

export const LeaderboardTop5HighlightCard: React.FC<LeaderboardTop5HighlightCardProps> = ({
  onPress,
  percentile = 'Top 5%',
  subtitle = 'See how you compare and what keeps you ahead.',
}) => {
  return (
    <View style={styles.outerContainer}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={styles.touchable}
      >
        <LinearGradient
          colors={['#20090D', '#130507', '#0B0305']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Left Emblem: Circular glow with Trophy & 3 ascending bars */}
          <View style={styles.emblemContainer}>
            <View style={styles.trophyWrapper}>
              <FontAwesome5 name="trophy" size={15} color="#F59E0B" />
            </View>
            <View style={styles.barsRow}>
              <View style={[styles.chartBar, { height: 7 }]} />
              <View style={[styles.chartBar, { height: 13 }]} />
              <View style={[styles.chartBar, { height: 9 }]} />
            </View>
          </View>

          {/* Center Text Info */}
          <View style={styles.textColumn}>
            <Text style={styles.titleText}>
              You <Text style={styles.bulletText}>• </Text>
              <Text style={styles.percentileText}>{percentile}</Text>
            </Text>
            <Text style={styles.subtitleText} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>

          {/* Right Chevron */}
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#EF4444"
            style={styles.chevron}
          />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  touchable: {
    borderRadius: 16,
  },
  cardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  emblemContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trophyWrapper: {
    marginBottom: 2,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
  },
  chartBar: {
    width: 3.5,
    backgroundColor: '#EF4444',
    borderRadius: 1.5,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 6,
  },
  titleText: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  bulletText: {
    color: '#9CA3AF',
    fontFamily: fontFamilies.regular,
  },
  percentileText: {
    color: '#EF4444',
    fontFamily: fontFamilies.bold,
  },
  subtitleText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 16,
    marginTop: 2,
  },
  chevron: {
    marginLeft: 4,
  },
});
