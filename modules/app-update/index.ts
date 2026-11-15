import { requireOptionalNativeModule } from 'expo';

type PlayUpdateInfo = {
  updateAvailable: boolean;
  immediateAllowed: boolean;
  storeVersionCode: number;
};

type HunterxAppUpdateModule = {
  checkForUpdate(): Promise<PlayUpdateInfo>;
  startImmediateUpdate(): Promise<boolean>;
};

/**
 * Google Play in-app updates (Android only). null on iOS, web, and on builds
 * made before this module existed, so callers must handle it being missing.
 */
export const PlayAppUpdate = requireOptionalNativeModule<HunterxAppUpdateModule>('HunterxAppUpdate');
