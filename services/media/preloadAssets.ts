import { Image as ExpoImage } from 'expo-image';
import { CLOUDINARY_ASSETS, STREAK_BADGE_ASSETS, STREAK_BADGE_WIDTH } from '@/constants/cloudinaryAssets';
import { optimizeCloudinaryUrl } from '@/services/media/cloudinary';
import { preloadTaskDoneSound } from '@/services/audio/taskDoneSound';

// login.tsx and ascension.tsx render these two at a width-capped Cloudinary
// variant (see their HERO_IMAGE_URI), not the raw asset URL below — so they
// need their own prefetch call for that exact derived URL, or the generic
// pass over CLOUDINARY_ASSETS never actually warms the cache they read from.
// They're also the very first screen a logged-out or freshly-onboarded user
// sees, often before the rest of this preload has had time to finish, so
// they go first and get a head start on network priority instead of
// competing equally with ~20 other images most screens don't need yet.
const PRIORITY_IMAGE_URLS = [
  optimizeCloudinaryUrl(CLOUDINARY_ASSETS.login_bg.uri, 1200),
  optimizeCloudinaryUrl(CLOUDINARY_ASSETS.screen.uri, 1200),
];

async function prefetchUrl(url: string): Promise<void> {
  try {
    // expo-image only: every screen showing these renders them with
    // expo-image, so a second download into RN Image's cache was never read.
    await ExpoImage.prefetch(url, 'memory-disk');
  } catch (e) {
    // Non-blocking: individual prefetch failure will gracefully fallback to on-demand load
  }
}

/**
 * Preloads and warms the memory and disk caches for all remote Cloudinary assets
 * and local sound assets so they render/play instantly with zero delay.
 */
export async function preloadAppAssets(): Promise<void> {
  await preloadPriorityAssets();
  await preloadRemainingAssets();
}

/**
 * The login/ascension hero images — needed the moment the launch splash
 * ends, so these start right away.
 */
export async function preloadPriorityAssets(): Promise<void> {
  await Promise.allSettled(PRIORITY_IMAGE_URLS.map(prefetchUrl));
}

/**
 * Everything else (sound buffer, the Cloudinary catalog, streak badges).
 * Started after the launch splash: done during it, the work made the splash
 * animation stutter on low-end phones.
 */
export async function preloadRemainingAssets(): Promise<void> {
  // Pre-warm done.m4a audio buffer for ultra-snappy feedback
  preloadTaskDoneSound().catch(() => { });

  // The exact URLs the screens request (same width as each screen's
  // optimizeCloudinaryUrl call), so the cache is actually hit. Assets no
  // screen shows (active_campaign_bg, popupsavatar, high_fidelity) and the
  // raw, uncapped originals are no longer downloaded. login_bg/screen are
  // covered above. Keep in step with:
  //   forgot-password.tsx (1200), RateHunterModal.tsx (1200), GuestPassCard.tsx (default)
  const imageUrls = [
    optimizeCloudinaryUrl(CLOUDINARY_ASSETS.lost_access_bg.uri, 1200),
    optimizeCloudinaryUrl(CLOUDINARY_ASSETS.rate_hunter_knight.uri, 1200),
    optimizeCloudinaryUrl(CLOUDINARY_ASSETS.refer_bg.uri),
  ];

  // Streak badges at the exact size StreakBadgeImage requests, so the badge
  // carousel and vault popup read them straight from the disk cache.
  const badgeUrls = Object.values(STREAK_BADGE_ASSETS).map((asset) =>
    optimizeCloudinaryUrl(asset.uri, STREAK_BADGE_WIDTH)
  );

  // Pre-cache the rest, a few at a time: firing every download at once
  // saturated low-end phones' CPU, disk and network for seconds.
  await prefetchInBatches([...imageUrls, ...badgeUrls], PREFETCH_CONCURRENCY);
}

const PREFETCH_CONCURRENCY = 4;

async function prefetchInBatches(urls: string[], concurrency: number): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      await prefetchUrl(url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
}
