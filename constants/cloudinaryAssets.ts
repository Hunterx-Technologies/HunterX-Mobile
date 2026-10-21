// constants/cloudinaryAssets.ts — Hosted Cloudinary Assets with f_auto,q_auto optimization
//
// Automatically applies Cloudinary automatic format (WebP/AVIF) and quality compression
// to reduce asset size by up to 90% and ensure blazing fast load times.

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

// Streak badge artwork (1024px originals). Kept out of CLOUDINARY_ASSETS so the
// startup preload fetches them at STREAK_BADGE_WIDTH instead of full size.
export const STREAK_BADGE_ASSETS = {
  ember_vow: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/v1792567664/hunterx/app-assets/streak-badges/ember_vow.png' },
  iron_resolve: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/v1792567665/hunterx/app-assets/streak-badges/iron_resolve.png' },
  shadow_oath: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/v1792567666/hunterx/app-assets/streak-badges/shadow_oath.png' },
  phantom_discipline: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/v1792567668/hunterx/app-assets/streak-badges/phantom_discipline.png' },
  sovereign_will: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/v1792567669/hunterx/app-assets/streak-badges/sovereign_will.png' },
  void_ascendant: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/v1792567670/hunterx/app-assets/streak-badges/void_ascendant.png' },
  eternal_hunter: { uri: 'https://res.cloudinary.com/sc8zzixt/image/upload/v1792567671/hunterx/app-assets/streak-badges/eternal_hunter.png' },
} as const;

// Largest badge on screen is 260pt (the vault popup); 768px keeps it sharp at
// 3x. Every badge render uses this one width so they all share a cache entry.
export const STREAK_BADGE_WIDTH = 768;
