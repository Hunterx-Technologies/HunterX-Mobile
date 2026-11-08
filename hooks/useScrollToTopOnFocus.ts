import { useCallback, type RefObject } from 'react';
import { useFocusEffect } from 'expo-router';

// Just longer than a screen transition, so the page sliding away doesn't jump.
const RESET_AFTER_MS = 400;

type Scrollable = {
  scrollTo?: (options: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
};

/**
 * Pages start at the top every time you come back to them, like normal page
 * navigation. Tab screens stay mounted when you switch tabs, and a screen
 * stays mounted underneath one pushed on top of it, so without this they
 * keep wherever you had scrolled to.
 *
 * The reset happens when you LEAVE the page (once the navigation animation is over,
 * so the page sliding away doesn't jump) rather than when you return — the
 * page is already at the top when it reappears, with no visible jump.
 *
 * Pass the ref of the page's main ScrollView / FlatList / SectionList
 * (Animated versions too).
 */
export function useScrollToTopOnFocus(ref: RefObject<Scrollable | null>) {
  useFocusEffect(
    useCallback(() => {
      return () => {
        // A fixed delay, not InteractionManager.runAfterInteractions: pages
        // with looping animations (e.g. the leaderboard's shimmering rows)
        // keep an interaction open forever, so that callback never ran.
        // Not cancelled on purpose: the reset must happen after the page is gone.
        setTimeout(() => {
          const node = ref.current;
          if (!node) return;
          if (typeof node.scrollToOffset === 'function') {
            node.scrollToOffset({ offset: 0, animated: false });
          } else if (typeof node.scrollTo === 'function') {
            node.scrollTo({ x: 0, y: 0, animated: false });
          }
        }, RESET_AFTER_MS);
      };
    }, [ref])
  );
}
