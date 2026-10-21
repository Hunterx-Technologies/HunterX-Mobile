import { useCallback, useState } from 'react';

import {
  getPushPermission,
  hasPromptedForPush,
  markPushPrompted,
  registerDeviceIfPermitted,
  requestPushPermission,
} from '@/services/notifications/push';

/**
 * In-app explainer shown before the one-shot OS permission prompt, so the
 * system dialog isn't spent on a cold first launch. Offered once — after the
 * hunter has earned XP (i.e. completed a quest) — and never again after
 * "Not now" or an answer; System Settings covers turning it on later.
 */
export function usePushPermissionPrompt() {
  const [visible, setVisible] = useState(false);

  /** Call when the screen is idle (no other modal up). */
  const maybeOffer = useCallback(async (eligible: boolean) => {
    if (!eligible) return;
    if ((await getPushPermission()) !== 'undetermined') return;
    if (await hasPromptedForPush()) return;
    setVisible(true);
  }, []);

  const accept = useCallback(async () => {
    setVisible(false);
    if ((await requestPushPermission()) === 'granted') {
      registerDeviceIfPermitted({ force: true }).catch(() => {});
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    markPushPrompted();
  }, []);

  return { visible, maybeOffer, accept, dismiss };
}
