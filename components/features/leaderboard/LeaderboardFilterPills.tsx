import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { fontFamilies } from '@/theme/typography';

export type MainCategoryTab = 'Global' | 'Friends';

interface TopCategoryFilterBarProps {
  category: MainCategoryTab;
  onSelectCategory: (category: MainCategoryTab) => void;
  /** A small count on a pill, e.g. friend requests waiting on Friends. */
  badges?: Partial<Record<MainCategoryTab, number>>;
}

const CATEGORIES: MainCategoryTab[] = ['Global', 'Friends'];

export const TopCategoryFilterBar: React.FC<TopCategoryFilterBarProps> = ({
  category,
  onSelectCategory,
  badges,
}) => {
  return (
    <View style={styles.topBarContainer}>
      <View style={styles.filterRow}>
        {CATEGORIES.map((tab) => {
          const isActive = category === tab;
          const badge = badges?.[tab] ?? 0;
          const badgeEl = badge > 0 ? (
            <View style={styles.badge} accessibilityLabel={`${badge} waiting`}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null;

          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.85}
              onPress={() => onSelectCategory(tab)}
              style={styles.tabTouchArea}
            >
              {isActive ? (
                <LinearGradient
                  colors={['#FE5B01', '#C44100', '#5C1D00']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.activePillGradient}
                >
                  <Text style={styles.activePillText}>{tab}</Text>
                  {badgeEl}
                </LinearGradient>
              ) : (
                <View style={styles.inactivePill}>
                  <Text style={styles.inactivePillText}>{tab}</Text>
                  {badgeEl}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  topBarContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabTouchArea: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Active Glowing Orange Pill */
  activePillGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#FE5B01',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 8,
    elevation: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePillText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Inactive Individual Pill */
  inactivePill: {
    backgroundColor: '#0D1114',
    borderWidth: 1,
    borderColor: '#1C232A',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactivePillText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#8D98A3',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
