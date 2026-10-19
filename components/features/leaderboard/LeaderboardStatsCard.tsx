import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { fontFamilies } from '@/theme/typography';

interface LeaderboardStatsCardProps {
  totalHunters?: string;
  totalXp?: string;
  activeHunters?: string;
}

export const LeaderboardStatsCard: React.FC<LeaderboardStatsCardProps> = ({
  totalHunters = '12,540',
  totalXp = '28.4M',
  activeHunters = '856',
}) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#16080A', '#100709', '#0C0608']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Subtle red outer border glow */}
        <View style={styles.glowBorder} />

        {/* 1. Total Hunters */}
        <View style={styles.statCol}>
          <View style={styles.iconBox}>
            <Ionicons name="people" size={20} color="#EF4444" />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.statValue}>{totalHunters}</Text>
            <Text style={styles.statLabel}>Total Hunters</Text>
          </View>
        </View>

        {/* 2. Total XP */}
        <View style={styles.statCol}>
          <View style={styles.iconBox}>
            <Ionicons name="flame" size={22} color="#F97316" />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.statValue}>{totalXp}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
        </View>

        {/* 3. Active Today */}
        <View style={styles.statCol}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="chart-bar" size={22} color="#F97316" />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.statValue}>{activeHunters}</Text>
            <Text style={styles.statLabel}>Active Today</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  cardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    position: 'relative',
    overflow: 'hidden',
  },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  statCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  statLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10.5,
    color: '#9CA3AF',
    marginTop: 1,
  },
});
