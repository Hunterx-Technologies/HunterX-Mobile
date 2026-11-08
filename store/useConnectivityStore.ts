import { AppState } from 'react-native';
import { create } from 'zustand';

import { env } from '@/config/env';

// Whether HunterX can reach its API right now. Detected from real traffic,
// not a native network module (none is installed, and adding one needs a new
// native build): any API response means online; a request that gets no
// response at all (no internet, Wi-Fi without internet, timeout) means
// offline. While offline, /api/health is polled until it answers, and the
// root layout shows the "No internet connection" pop-up (OfflineNotice).

const RETRY_EVERY_MS = 5000;
const CHECK_TIMEOUT_MS = 5000;

type ConnectivityState = {
  isOffline: boolean;
  isChecking: boolean;
};

export const useConnectivityStore = create<ConnectivityState>(() => ({
  isOffline: false,
  isChecking: false,
}));

let retryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (useConnectivityStore.getState().isOffline) checkConnectivity();
  }, RETRY_EVERY_MS);
}

/** Called by the API client: a response arrived (any status). */
export function markOnline() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (useConnectivityStore.getState().isOffline) useConnectivityStore.setState({ isOffline: false });
}

/** Called by the API client: a request got no response at all. */
export function markOffline() {
  if (!useConnectivityStore.getState().isOffline) useConnectivityStore.setState({ isOffline: true });
  scheduleRetry();
}

/** Pings the API's health endpoint. Resolves true when it's reachable. */
export async function checkConnectivity(): Promise<boolean> {
  useConnectivityStore.setState({ isChecking: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    // Any HTTP answer (even 503 "database down") proves the connection works.
    await fetch(`${env.apiUrl}/health`, { method: 'GET', signal: controller.signal, cache: 'no-store' });
    markOnline();
    return true;
  } catch {
    markOffline();
    return false;
  } finally {
    clearTimeout(timeout);
    useConnectivityStore.setState({ isChecking: false });
  }
}

/** Resolves once the API is reachable again (immediately if it already is). */
export function whenOnline(): Promise<void> {
  if (!useConnectivityStore.getState().isOffline) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useConnectivityStore.subscribe((state) => {
      if (!state.isOffline) {
        unsubscribe();
        resolve();
      }
    });
  });
}

// Coming back to the app (e.g. after turning mobile data on in Settings):
// check straight away instead of waiting for the next retry.
AppState.addEventListener('change', (next) => {
  if (next === 'active' && useConnectivityStore.getState().isOffline) checkConnectivity();
});
