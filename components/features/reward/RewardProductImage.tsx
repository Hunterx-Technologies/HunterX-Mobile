import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { DEFAULT_BLURHASH, optimizeCloudinaryUrl } from '@/services/media/cloudinary';

/** Shown when a reward has no product image, or its image fails to load. */
const DEFAULT_REWARD_IMAGE = require('../../../assets/images/hunterx_reward_emblem.webp');

/**
 * Widths (px) to request from Cloudinary for each place a reward image
 * appears — about 3x its on-screen width on the largest phones. Coupon
 * images are stored at most 1200px wide (HunterX-Backend
 * adminRewardService.js), so nothing asks for more.
 */
export const REWARD_IMAGE_WIDTH = {
  /** Wallet grid card, ~192pt wide. */
  grid: 600,
  /** Centered scratch card, 310pt wide. */
  scratchCard: 960,
  /** Reward details hero, ~400pt wide. */
  details: 1200,
} as const;

interface Props {
  uri?: string | null;
  /** Requested width in px — use REWARD_IMAGE_WIDTH. */
  width: number;
}

/**
 * A reward's product image, filling its container (cover). Falls back to
 * the HunterX reward emblem when there's no image or it fails to load, so a
 * card never shows a blank or broken image.
 */
export function RewardProductImage({ uri, width }: Props) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const useDefault = !uri || failedUri === uri;

  if (useDefault) {
    return (
      <View style={styles.fallback}>
        <Image source={DEFAULT_REWARD_IMAGE} style={styles.emblem} contentFit="contain" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: optimizeCloudinaryUrl(uri, width) }}
      style={styles.fill}
      contentFit="cover"
      placeholder={{ blurhash: DEFAULT_BLURHASH }}
      transition={200}
      cachePolicy="memory-disk"
      onError={() => setFailedUri(uri)}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1C20',
  },
  emblem: {
    width: '62%',
    height: '62%',
  },
});
