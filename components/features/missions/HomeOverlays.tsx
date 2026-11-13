import React from 'react';

import { TaskCompletedToast } from '@/components/features/missions/TaskCompletedToast';
import { TaskCompletionBottomSheet } from '@/components/features/missions/TaskCompletionBottomSheet';
import { useHomeOverlayStore } from '@/store/useHomeOverlayStore';
import type { User } from '@/types/user';

/**
 * Home's task-completed toast, error toast and first-quest bottom sheet,
 * drawn from useHomeOverlayStore. Showing or hiding one re-renders only
 * this, not the Home screen.
 */
function HomeOverlaysComponent({ streakDays, weekStatus }: { streakDays: number; weekStatus?: User['week_status'] }) {
  const completedToast = useHomeOverlayStore((s) => s.completedToast);
  const errorToast = useHomeOverlayStore((s) => s.errorToast);
  const sheet = useHomeOverlayStore((s) => s.sheet);
  const hideCompletedToast = useHomeOverlayStore((s) => s.hideCompletedToast);
  const hideErrorToast = useHomeOverlayStore((s) => s.hideErrorToast);
  const hideTaskSheet = useHomeOverlayStore((s) => s.hideTaskSheet);

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

      {/* Task Completion Celebration Bottom Sheet Modal */}
      <TaskCompletionBottomSheet
        visible={sheet.visible}
        title={sheet.title}
        subtitle={sheet.subtitle}
        streakDays={streakDays}
        xp={sheet.xp}
        weekStatus={weekStatus}
        onClose={hideTaskSheet}
        onContinue={hideTaskSheet}
      />
    </>
  );
}

export const HomeOverlays = React.memo(HomeOverlaysComponent);
