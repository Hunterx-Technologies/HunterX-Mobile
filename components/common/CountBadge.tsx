import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fontFamilies } from '@/theme/typography';

/**
 * A small red count on the corner of a button (Instagram style). Put it
 * inside the button, which needs no overflow clipping. Renders nothing at 0.
 * `ringColor` should match what's behind the button, so the badge looks cut
 * out of it.
 */
export function CountBadge({
  count,
  ringColor = '#0D1115',
  style,
}: {
  count: number;
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, { borderColor: ringColor }, style]} pointerEvents="none">
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#FF3040',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
    lineHeight: 13,
    color: '#FFFFFF',
  },
});
