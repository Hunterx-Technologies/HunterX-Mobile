import { useEffect, useState } from 'react';
import type { ApiResponse } from '@/types/api';
import { apiClient } from './client';

export interface AvatarItem {
  id: string;
  name: string;
  image_url: string;
  gender?: string;
  is_default?: boolean;
  unlock_at_level?: number;
}

// ── Official 10 HunterX Profile Avatars ─────────────────────────
export const OFFICIAL_HUNTER_AVATARS: AvatarItem[] = [
  {
    id: '1',
    name: 'Ren, the Frost Blade',
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1788468328/hunterx/app-assets/arise_avatar_11.jpg',
    gender: 'female',
    is_default: false,
  },
  {
    id: '2',
    name: 'Draven, the Ember Knight',
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861199/hunterx/app-assets/arise_avatar_8.png',
    gender: 'male',
    is_default: false,
  },
  {
    id: '3',
    name: "Vesa, the Viper's Gaze",
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861198/hunterx/app-assets/arise_avatar_7.png',
    gender: 'female',
    is_default: false,
  },
  {
    id: '4',
    name: 'Rook, the Grinning Wolf',
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861196/hunterx/app-assets/arise_avatar_6.png',
    gender: 'male',
    is_default: false,
  },
  {
    id: '5',
    name: 'Silas, the Hollow Wanderer',
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861195/hunterx/app-assets/arise_avatar_5.png',
    gender: 'male',
    is_default: false,
  },
  {
    id: '6',
    name: 'Talon, the Scarred Sentinel',
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861193/hunterx/app-assets/arise_avatar_4.png',
    gender: 'female',
    is_default: true,
  },
  {
    id: '7',
    name: 'Isolde, the Silver Wraith',
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861192/hunterx/app-assets/arise_avatar_3.png',
    gender: 'female',
    is_default: false,
  },
  {
    id: '8',
    name: 'Corvin, the Quiet Analyst',
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861187/hunterx/app-assets/arise_avatar_1.png',
    gender: 'male',
    is_default: false,
  },
  {
    id: '9',
    name: 'Zane, the Void Stare',
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861190/hunterx/app-assets/arise_avatar_2.png',
    gender: 'male',
    is_default: true,
  },
  {
    id: '10',
    name: 'Kael, the Crimson Eye',
    image_url: 'https://res.cloudinary.com/sc8zzixt/image/upload/f_auto,q_auto/v1787861200/hunterx/app-assets/arise_avatar_9.png',
    gender: 'male',
    is_default: false,
  },
];

let cachedAvatars: AvatarItem[] | null = null;
let fetchPromise: Promise<AvatarItem[]> | null = null;

// Lets components (e.g. the Profile/Home avatar) re-render once the avatar
// catalog finishes loading, so `getAvatarSource` can resolve the real image
// for a user's avatar_id instead of being stuck on the generic fallback that
// it returns while `cachedAvatars` is still empty.
type Listener = () => void;
const listeners = new Set<Listener>();

function notifyAvatarsReady() {
  listeners.forEach((listener) => listener());
}

export async function getAvatars(): Promise<AvatarItem[]> {
  if (cachedAvatars && cachedAvatars.length > 0) {
    return cachedAvatars;
  }
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const { data } = await apiClient.get<ApiResponse<{ avatars: AvatarItem[] } | AvatarItem[]>>('/avatars');
      const rawList = (data as any)?.data?.avatars || (data as any)?.data || (data as any)?.avatars || data;
      if (Array.isArray(rawList) && rawList.length > 0) {
        cachedAvatars = rawList.map((a: any) => ({
          id: String(a.id),
          name: a.name || `Avatar ${a.id}`,
          image_url: a.image_url || a.imageUrl || a.url || '',
          gender: a.gender,
          is_default: !!a.is_default,
          unlock_at_level: a.unlock_at_level ?? 0,
        }));
        return cachedAvatars;
      }
    } catch (err: any) {
      const isNotFound = err?.response?.status === 404 || (err?.message && err.message.includes('404'));
      if (isNotFound) {
        try {
          const { data } = await apiClient.get<ApiResponse<{ avatars: AvatarItem[] } | AvatarItem[]>>('/api/avatars');
          const rawList = (data as any)?.data?.avatars || (data as any)?.data || (data as any)?.avatars || data;
          if (Array.isArray(rawList) && rawList.length > 0) {
            cachedAvatars = rawList.map((a: any) => ({
              id: String(a.id),
              name: a.name || `Avatar ${a.id}`,
              image_url: a.image_url || a.imageUrl || a.url || '',
              gender: a.gender,
              is_default: !!a.is_default,
              unlock_at_level: a.unlock_at_level ?? 0,
            }));
            return cachedAvatars;
          }
        } catch {
          // Ignore inner error
        }
      }
    } finally {
      fetchPromise = null;
      notifyAvatarsReady();
    }
    return cachedAvatars || [];
  })();

  return fetchPromise;
}

export function getCachedAvatars(): AvatarItem[] {
  return cachedAvatars && cachedAvatars.length > 0 ? cachedAvatars : OFFICIAL_HUNTER_AVATARS;
}

/**
 * Forces a re-render once the avatar catalog has loaded. Mount this in any
 * screen that renders the current user's avatar via `getAvatarSource` so it
 * doesn't get stuck showing the generic fallback image while
 * `cachedAvatars` is still empty (e.g. on a cold app start).
 */
export function useAvatarsReady(): boolean {
  const [ready, setReady] = useState(!!cachedAvatars);

  useEffect(() => {
    if (cachedAvatars) {
      setReady(true);
      return;
    }

    const listener = () => setReady(!!cachedAvatars);
    listeners.add(listener);
    getAvatars().catch(() => { });

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return ready;
}
