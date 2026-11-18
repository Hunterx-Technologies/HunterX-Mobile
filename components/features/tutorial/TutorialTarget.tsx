import React, { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { registerTutorialTarget } from '@/store/useTutorialStore';

/** Marks a view the app tour can spotlight (see tutorialSteps.ts). Layout-neutral. */
export function TutorialTarget({
  id,
  style,
  children,
}: {
  id: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const ref = useRef<View>(null);
  useEffect(() => registerTutorialTarget(id, ref), [id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
