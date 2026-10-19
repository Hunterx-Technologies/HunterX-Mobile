import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { fontFamilies } from '@/theme/typography';

export type MainCategoryTab = 'Global' | 'Friends';

interface TopCategoryFilterBarProps {
  category: MainCategoryTab;
  onSelectCategory: (category: MainCategoryTab) => void;
}

const CATEGORIES: MainCategoryTab[] = ['Global', 'Friends'];

export const TopCategoryFilterBar: React.FC<TopCategoryFilterBarProps> = ({
  category,
  onSelectCategory,
}) => {
  return (
    <View style={styles.topBarContainer}>
      <View style={styles.filterRow}>
        {CATEGORIES.map((cat) => {
          const isActive = category === cat;

          return (
            <TouchableOpacity
              key={cat}
              activeOpacity={0.8}
              onPress={() => onSelectCategory(cat)}
              style={styles.pillTouch}
            >
              {isActive ? (
                <LinearGradient
                  colors={['#DC2626', '#B91C1C', '#991B1B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activePillGradient}
                >
                  <Text style={styles.activePillText}>{cat}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.inactivePill}>
                  <Text style={styles.inactivePillText}>{cat}</Text>
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
  topBarContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pillTouch: {
    flex: 1,
  },

  /* Active Glowing Red Pill */
  activePillGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9.5,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 7,
    elevation: 4,
  },
  activePillText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  /* Inactive Pill */
  inactivePill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121217',
    borderWidth: 1,
    borderColor: '#24242F',
    borderRadius: 22,
    paddingVertical: 9.5,
    paddingHorizontal: 14,
  },
  inactivePillText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13.5,
    color: '#9CA3AF',
    letterSpacing: 0.2,
  },
});
