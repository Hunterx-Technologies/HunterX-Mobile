import React, { useRef } from 'react';

/**
 * Renders its children only once `visible` has been true at least once, then
 * keeps them mounted. For screens with many modals: a modal that's never
 * opened costs nothing, while one that has been opened keeps its state and
 * its open/close animations behave exactly as before.
 */
export function MountWhenOpened({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const opened = useRef(false);
  if (visible) opened.current = true;
  return opened.current ? <>{children}</> : null;
}
