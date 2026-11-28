// constants/cloudinaryAssets.ts — Hosted Cloudinary Assets with f_auto,q_auto optimization
//
// Automatically applies Cloudinary automatic format (WebP/AVIF) and quality compression
// to reduce asset size by up to 90% and ensure blazing fast load times.

import { env, isProductionApi } from '@/config/env';

export const CLOUDINARY_ASSETS: Record<string, { uri: string }> = {
  active_campaign_bg: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861185/hunterx/app-assets/active_campaign_bg.jpg' },

  high_fidelity: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861220/hunterx/app-assets/high_fidelity.png' },
  login_bg: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861223/hunterx/app-assets/login_bg.png' },
  lost_access_bg: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861226/hunterx/app-assets/lost_access_bg.png' },
  popupsavatar: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861231/hunterx/app-assets/popupsavatar.jpg' },
  rate_hunter_knight: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1788382200/hunterx/app-assets/rate_hunter_knight.jpg' },
  refer_bg: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861235/hunterx/app-assets/refer_bg.png' },
  screen: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861237/hunterx/app-assets/screen.png' },
};

// Streak badge artwork (1024px originals), uploaded to both Cloudinary roots:
// production reads hunterx/, UAT and local backends read hunterx-uat/ (the
// backend's CLOUDINARY_FOLDER convention). Kept out of CLOUDINARY_ASSETS so
// the startup preload fetches them at STREAK_BADGE_WIDTH instead of full size.
// Versions are per root: re-uploading a badge means updating its pair here.
const BADGE_ROOT = isProductionApi(env.apiUrl) ? 'hunterx' : 'hunterx-uat';
const badge = (slug: string, prodVersion: string, uatVersion: string) => ({
  uri: `https://res.cloudinary.com/sc8zzixt/image/upload/${BADGE_ROOT === 'hunterx' ? prodVersion : uatVersion}/${BADGE_ROOT}/app-assets/streak-badges/${slug}.png`,
});

export const STREAK_BADGE_ASSETS = {
  ember_vow: badge('ember_vow', 'v1795872300', 'v1795872302'),
  iron_resolve: badge('iron_resolve', 'v1795872304', 'v1795872305'),
  habit_forged: badge('habit_forged', 'v1795872307', 'v1795872310'),
  shadow_oath: badge('shadow_oath', 'v1795872312', 'v1795872314'),
  night_vigil: badge('night_vigil', 'v1795872316', 'v1795872318'),
  phantom_discipline: badge('phantom_discipline', 'v1795872320', 'v1795872322'),
  blade_unbroken: badge('blade_unbroken', 'v1795872324', 'v1795872326'),
  sovereign_will: badge('sovereign_will', 'v1795872327', 'v1795872329'),
  crimson_resolve: badge('crimson_resolve', 'v1795872331', 'v1795872333'),
  steel_ascent: badge('steel_ascent', 'v1795872335', 'v1795872336'),
  void_ascendant: badge('void_ascendant', 'v1795872338', 'v1795872340'),
  abyss_walker: badge('abyss_walker', 'v1795872341', 'v1795872343'),
  dragonbound_will: badge('dragonbound_will', 'v1795872344', 'v1795872346'),
  eternal_hunter: badge('eternal_hunter', 'v1795872348', 'v1795872350'),
  immortal_flame: badge('immortal_flame', 'v1795872351', 'v1795872353'),
  undying_legend: badge('undying_legend', 'v1795872355', 'v1795872356'),
  mythic_hunter: badge('mythic_hunter', 'v1795872359', 'v1795872361'),
} as const;

// Largest badge on screen is 260pt (the vault popup); 768px keeps it sharp at
// 3x. Every badge render uses this one width so they all share a cache entry.
export const STREAK_BADGE_WIDTH = 768;
