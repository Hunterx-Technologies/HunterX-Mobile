import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router, usePathname, type Href } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { markNotificationsRead } from '@/services/api/notifications.service';
import { syncUnseenRewards } from '@/hooks/useUnseenRewardsSync';
import {
  configureForegroundHandling,
  isDeviceTokenRotation,
  isPushSupported,
  registerDeviceIfPermitted,
} from '@/services/notifications/push';

configureForegroundHandling();

const logRegisterError = (err: unknown) =>
  console.warn('[push] device registration failed:', (err as any)?.response?.data?.message ?? (err as any)?.message ?? err);

/**
 * Mounted once in app/_layout.tsx. While signed in:
 *  - registers the device (sign-in, every foreground, token rotation)
 *  - keeps the unread badge fresh when a push arrives / app returns
 *  - routes notification taps to `data.url` and marks them read — including
 *    the tap that cold-started the app. A tap is held until the session is
 *    restored, the user is onboarded and app/index.tsx has redirected away
 *    from "/", so that redirect can't override it.
 */
export function usePushNotifications() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const pathname = usePathname();

  const pendingResponse = useRef<Notifications.NotificationResponse | null>(null);
  const handledIds = useRef(new Set<string>());

  const readyToRoute = !isBootstrapping && userId !== null && isOnboarded && pathname !== '/';
  const readyRef = useRef(readyToRoute);
  readyRef.current = readyToRoute;

  const routeResponse = (response: Notifications.NotificationResponse) => {
    const id = response.notification.request.identifier;
    if (handledIds.current.has(id)) return;
    handledIds.current.add(id);
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const data = response.notification.request.content.data ?? {};
    if (typeof data.notification_id === 'string') {
      markNotificationsRead([data.notification_id])
        .then(useNotificationStore.getState().setUnreadCount)
        .catch(() => {});
    }
    if (typeof data.url === 'string' && data.url.startsWith('/')) {
      router.push(data.url as Href);
    }
    // The push only names the card; the unseen list is what queues its
    // celebration (and never carries the prize).
    if (data.type === 'REWARD_READY') syncUnseenRewards();
  };

  // Capture taps (cold start + while running); route when ready.
  useEffect(() => {
    if (!isPushSupported) return;
    const capture = (response: Notifications.NotificationResponse | null) => {
      if (response) pendingResponse.current = response;
    };
    Notifications.getLastNotificationResponseAsync().then(capture).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      capture(response);
      if (pendingResponse.current && readyRef.current) {
        routeResponse(pendingResponse.current);
        pendingResponse.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (readyToRoute && pendingResponse.current) {
      routeResponse(pendingResponse.current);
      pendingResponse.current = null;
    }
  }, [readyToRoute]);

  // Signed-in lifecycle: registration, badge refresh, token rotation.
  useEffect(() => {
    if (!isPushSupported || isBootstrapping || userId === null) return;

    const { refreshUnreadCount } = useNotificationStore.getState();
    registerDeviceIfPermitted().catch(logRegisterError);
    refreshUnreadCount();

    const received = Notifications.addNotificationReceivedListener(() => refreshUnreadCount());
    const tokenRotated = Notifications.addPushTokenListener(({ data }) => {
      if (typeof data === 'string' && isDeviceTokenRotation(data)) {
        registerDeviceIfPermitted({ force: true }).catch(logRegisterError);
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        registerDeviceIfPermitted().catch(logRegisterError);
        refreshUnreadCount();
      }
    });

    return () => {
      received.remove();
      tokenRotated.remove();
      appState.remove();
    };
  }, [isBootstrapping, userId]);
}
