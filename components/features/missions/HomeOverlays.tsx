import React from 'react';

import { TaskCompletedToast } from '@/components/features/missions/TaskCompletedToast';
import { useHomeOverlayStore } from '@/store/useHomeOverlayStore';

/**
 * Home's task-completed and error toasts, drawn from useHomeOverlayStore.
 * Showing or hiding one re-renders only this, not the Home screen.
 */
function HomeOverlaysComponent() {
  const completedToast = useHomeOverlayStore((s) => s.completedToast);
  const errorToast = useHomeOverlayStore((s) => s.errorToast);
  const hideCompletedToast = useHomeOverlayStore((s) => s.hideCompletedToast);
  const hideErrorToast = useHomeOverlayStore((s) => s.hideErrorToast);

  return (
    <>
      {/* Task Completed Toast Popup */}
      <TaskCompletedToast
        visible={completedToast.visible}
        xp={completedToast.xp}
        title={completedToast.title}
        subtitle={completedToast.subtitle}
        onDismiss={hideCompletedToast}
      />

      {/* Error Toast Popup */}
      <TaskCompletedToast
        visible={errorToast.visible}
        title={errorToast.title}
        subtitle={errorToast.subtitle}
        isError={true}
        onDismiss={hideErrorToast}
      />
    </>
  );
}

export const HomeOverlays = React.memo(HomeOverlaysComponent);
