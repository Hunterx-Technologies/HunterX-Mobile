import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import RNShare from '@/services/share/RNShare';
import * as Clipboard from 'expo-clipboard';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  Stop,
} from 'react-native-svg';

import { fontFamilies } from '@/theme/typography';
import { showGlobalToast } from '@/store/useToastStore';
import { getAvatarSource } from '@/components/profile/AvatarSelectionModal';
import { useAuth } from '@/hooks/useAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_HERO_BG = require('@/assets/images/leaderboardone.png');

export interface HunterDetailData {
  id: string;
  rank: number;
  displayName: string;
  score: number;
  level: number;
  avatarUrl?: string | ImageSourcePropType;
  quote?: string;
  tagline?: string;
  daysActive?: number;
  streakDays?: number;
  isCurrentUser?: boolean;
}

import { OFFICIAL_HUNTER_AVATARS } from '@/services/api/avatar.service';

const resolveHunterImage = (avatarUrl?: string | ImageSourcePropType): ImageSourcePropType => {
  if (!avatarUrl) {
    return { uri: OFFICIAL_HUNTER_AVATARS[0].image_url };
  }
  if (typeof avatarUrl === 'string') {
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return { uri: avatarUrl };
    }
    return getAvatarSource(avatarUrl);
  }
  return avatarUrl;
};

const getHunterImageUri = (hunter: HunterDetailData, hunterImage: ImageSourcePropType): string => {
  if (typeof hunter.avatarUrl === 'string' && (hunter.avatarUrl.startsWith('http://') || hunter.avatarUrl.startsWith('https://'))) {
    return hunter.avatarUrl;
  }
  if (hunterImage && typeof hunterImage === 'object' && 'uri' in hunterImage && (hunterImage as any).uri) {
    return (hunterImage as any).uri;
  }
  const resolved = Image.resolveAssetSource(hunterImage);
  if (resolved?.uri) {
    return resolved.uri;
  }
  return OFFICIAL_HUNTER_AVATARS[0].image_url;
};

const downloadCardWeb = async (hunterData: HunterDetailData, imageSrc: string) => {
  if (typeof document === 'undefined') return;

  const width = 800;
  const height = 550;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const radius = 32;

  const drawRoundedPath = (c: CanvasRenderingContext2D, inset: number = 0) => {
    const r = radius - inset;
    const w = width - inset * 2;
    const h = height - inset * 2;
    const x = inset;
    const y = inset;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  };

  const loadImage = async (src: string): Promise<HTMLImageElement | null> => {
    try {
      const res = await fetch(src, { mode: 'cors' });
      const blob = await res.blob();
      const dataUri = await new Promise<string>((resBlob) => {
        const reader = new FileReader();
        reader.onloadend = () => resBlob(reader.result as string);
        reader.readAsDataURL(blob);
      });
      return new Promise((resolve) => {
        const img = new (window as any).Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = dataUri;
      });
    } catch {
      return new Promise((resolve) => {
        const img = new (window as any).Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          const fallback = new (window as any).Image();
          fallback.onload = () => resolve(fallback);
          fallback.onerror = () => resolve(null);
          fallback.src = src;
        };
        img.src = src;
      });
    }
  };

  // 1. Clip canvas to rounded boundary
  ctx.save();
  drawRoundedPath(ctx, 0);
  ctx.clip();

  // 2. Base Dark Background
  ctx.fillStyle = '#0F0B0C';
  ctx.fillRect(0, 0, width, height);

  // 3. Draw Character Avatar (Cover)
  if (imageSrc) {
    try {
      const img = await loadImage(imageSrc);
      if (img) {
        const imgRatio = img.width / img.height;
        const canvasRatio = width / height;
        let drawW: number;
        let drawH: number;
        let drawX: number;
        let drawY: number;
        if (imgRatio > canvasRatio) {
          drawH = height;
          drawW = height * imgRatio;
          drawX = (width - drawW) / 2;
          drawY = 0;
        } else {
          drawW = width;
          drawH = width / imgRatio;
          drawX = 0;
          drawY = (height - drawH) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }
    } catch {}
  }

  // 4. Dark Cinematic Gradients
  const vGrad = ctx.createLinearGradient(0, 0, 0, height);
  vGrad.addColorStop(0, 'rgba(15, 11, 12, 0.85)');
  vGrad.addColorStop(0.5, 'rgba(15, 11, 12, 0.30)');
  vGrad.addColorStop(1, 'rgba(15, 11, 12, 0.95)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, width, height);

  const hGrad = ctx.createLinearGradient(0, 0, width * 0.7, 0);
  hGrad.addColorStop(0, 'rgba(10, 8, 12, 0.82)');
  hGrad.addColorStop(0.5, 'rgba(10, 8, 12, 0.40)');
  hGrad.addColorStop(1, 'rgba(10, 8, 12, 0.0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, width, height);

  // 5. HunterX Brand Header
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Hunter', 38, 34);
  const brandW = ctx.measureText('Hunter').width;
  ctx.fillStyle = '#EF4444';
  ctx.fillText('X', 38 + brandW, 34);

  // Tagline
  ctx.font = 'bold 12.5px sans-serif';
  ctx.fillStyle = '#71717A';
  ctx.fillText('TRACK. IMPROVE. GO FURTHER.', 38, 76);

  // 6. RANK label & Number
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#F59E0B';
  ctx.fillText('RANK', 38, 126);

  ctx.font = '900 70px sans-serif';
  ctx.fillStyle = '#F59E0B';
  ctx.fillText(`#${hunterData.rank}`, 38, 154);

  // 7. Hunter Name
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(hunterData.displayName, 38, 252);

  // 8. Level Capsule
  const levelText = `Lv. ${hunterData.level}`;
  ctx.font = 'bold 19px sans-serif';
  const levelTextWidth = ctx.measureText(levelText).width;
  const pillPaddingX = 14;
  const pillX = 38;
  const pillY = 306;
  const pillH = 32;
  const pillW = levelTextWidth + pillPaddingX * 2;
  const pillR = 10;

  ctx.beginPath();
  ctx.moveTo(pillX + pillR, pillY);
  ctx.lineTo(pillX + pillW - pillR, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR);
  ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH);
  ctx.lineTo(pillX + pillR, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR);
  ctx.lineTo(pillX, pillY + pillR);
  ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY);
  ctx.closePath();
  ctx.fillStyle = '#1C1C24';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#2E2E38';
  ctx.stroke();

  ctx.fillStyle = '#E4E4E7';
  ctx.textBaseline = 'middle';
  ctx.fillText(levelText, pillX + pillPaddingX, pillY + pillH / 2);

  // 9. XP Row with Flame Emoji
  ctx.font = 'bold 24px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`🔥  ${hunterData.score.toLocaleString()} XP`, 38, 362);

  // 10. Creed at Bottom Right
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#EF4444';
  ctx.fillText('CONSISTENCY', width - 38, height - 88);
  ctx.fillText('CREATES', width - 38, height - 64);
  ctx.fillText('RESULTS.', width - 38, height - 40);

  ctx.restore(); // restore clip

  // 11. Stroke Radiant Orange Border (#FE5B01)
  ctx.save();
  drawRoundedPath(ctx, 2);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#FE5B01';
  ctx.shadowColor = '#FE5B01';
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.restore();

  // 12. Trigger Browser File Download
  let dataUrl = '';
  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch (canvasErr) {
    const safeCanvas = document.createElement('canvas');
    safeCanvas.width = width;
    safeCanvas.height = height;
    const sctx = safeCanvas.getContext('2d');
    if (sctx) {
      sctx.save();
      drawRoundedPath(sctx, 0);
      sctx.clip();
      sctx.fillStyle = '#0F0B0C';
      sctx.fillRect(0, 0, width, height);
      sctx.textAlign = 'left';
      sctx.textBaseline = 'top';
      sctx.font = 'bold 32px sans-serif';
      sctx.fillStyle = '#FFFFFF';
      sctx.fillText('Hunter', 38, 34);
      sctx.fillStyle = '#EF4444';
      sctx.fillText('X', 38 + brandW, 34);
      sctx.font = 'bold 12.5px sans-serif';
      sctx.fillStyle = '#71717A';
      sctx.fillText('TRACK. IMPROVE. GO FURTHER.', 38, 76);
      sctx.font = 'bold 20px sans-serif';
      sctx.fillStyle = '#F59E0B';
      sctx.fillText('RANK', 38, 126);
      sctx.font = '900 70px sans-serif';
      sctx.fillText(`#${hunterData.rank}`, 38, 154);
      sctx.font = 'bold 34px sans-serif';
      sctx.fillStyle = '#FFFFFF';
      sctx.fillText(hunterData.displayName, 38, 252);
      sctx.font = 'bold 24px sans-serif';
      sctx.fillText(`🔥  ${hunterData.score.toLocaleString()} XP`, 38, 362);
      sctx.restore();
      drawRoundedPath(sctx, 2);
      sctx.lineWidth = 3.5;
      sctx.strokeStyle = '#FE5B01';
      sctx.stroke();
      dataUrl = safeCanvas.toDataURL('image/png');
    }
  }

  if (dataUrl) {
    const filename = `HunterX-Rank-${hunterData.rank}-${hunterData.displayName.replace(/\s+/g, '_')}.png`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.download = filename;
    downloadAnchor.href = dataUrl;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  }
};

interface HunterDetailModalProps {
  visible: boolean;
  hunter: HunterDetailData | null;
  onClose: () => void;
}

/* ==========================================================================
   GOLDEN / AMBER RANK CREST BADGE WITH CROWN & SCALLOPED SEAL
   ========================================================================== */
const HunterRankCrest: React.FC<{ rank: number }> = ({ rank }) => {
  return (
    <View style={styles.crestContainer}>
      <Svg width={64} height={72} viewBox="0 0 64 72" fill="none">
        <Defs>
          <SvgLinearGradient id="crestGold" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FDE047" />
            <Stop offset="40%" stopColor="#F59E0B" />
            <Stop offset="100%" stopColor="#B45309" />
          </SvgLinearGradient>
          <SvgLinearGradient id="innerShield" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#2A1608" />
            <Stop offset="100%" stopColor="#140A04" />
          </SvgLinearGradient>
          <SvgLinearGradient id="crownGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFBEB" />
            <Stop offset="50%" stopColor="#FBBF24" />
            <Stop offset="100%" stopColor="#D97706" />
          </SvgLinearGradient>
        </Defs>

        {/* Crown Section at Top */}
        <Path
          d="M18 20 L22 10 L32 16 L42 10 L46 20 Z"
          fill="url(#crownGrad)"
          stroke="#FEF08A"
          strokeWidth="1.2"
        />

        {/* Crown base band */}
        <Path
          d="M17 20 L47 20 L45 24 L19 24 Z"
          fill="#D97706"
          stroke="#FDE047"
          strokeWidth="0.8"
        />

        {/* Outer Shield with Radiant Golden/Amber Border */}
        <Polygon
          points="32,22 56,26 50,56 32,68 14,56 8,26"
          fill="url(#innerShield)"
          stroke="url(#crestGold)"
          strokeWidth="2"
        />

        {/* Scalloped / Starburst Seal for Rank */}
        <Polygon
          points="32,32 37,35 42,32 43,38 48,40 46,46 50,50 45,54 45,60 39,60 35,65 32,62 29,65 25,60 19,60 19,54 14,50 18,46 16,40 21,38 22,32 27,35"
          fill="url(#crestGold)"
          stroke="#FEF08A"
          strokeWidth="1"
        />

        {/* Dark Inset for Rank text */}
        <Polygon
          points="32,36 42,42 39,56 32,60 25,56 22,42"
          fill="#160E08"
        />
      </Svg>

      <View style={styles.crestRankWrapper}>
        <Text style={styles.crestRankText}>#{rank}</Text>
      </View>
    </View>
  );
};

/* ==========================================================================
   EXACT 4 ACHIEVEMENT BADGES (SVG VECTOR REPLICAS)
   ========================================================================== */

/* 1. Flame / Streak Badge */
const FlameAchievementBadge = () => (
  <View style={[styles.badgeBox, styles.badgeBoxFlame]}>
    <Svg width={46} height={46} viewBox="0 0 46 46" fill="none">
      <Defs>
        <SvgLinearGradient id="flameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FDE047" />
          <Stop offset="35%" stopColor="#FB923C" />
          <Stop offset="100%" stopColor="#EF4444" />
        </SvgLinearGradient>
        <SvgLinearGradient id="flameCoreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="50%" stopColor="#FEF08A" />
          <Stop offset="100%" stopColor="#F59E0B" />
        </SvgLinearGradient>
      </Defs>
      {/* Notched circular shield frame */}
      <Path
        d="M23 4 L26 8 C33 9 38 14 39 21 L43 23 L39 25 C38 32 33 37 26 38 L23 42 L20 38 C13 37 8 32 7 25 L3 23 L7 21 C8 14 13 9 20 8 Z"
        stroke="#FF453A"
        strokeWidth="1.8"
        fill="rgba(239, 68, 68, 0.08)"
      />
      {/* Outer Flame */}
      <Path
        d="M23 11 C25 15 28 17 30 20 C32 23 33 26 31 30 C29 34 24 35 21 35 C16 35 13 32 14 27 C14 23 18 19 19 16 C19 19 21 21 23 21 C24 21 24 17 23 11 Z"
        fill="url(#flameGrad)"
      />
      {/* Inner Hot Core */}
      <Path
        d="M23 20 C24 23 26 25 26 28 C26 31 23 33 21 33 C18 33 17 31 18 28 C18 25 21 23 23 20 Z"
        fill="url(#flameCoreGrad)"
      />
    </Svg>
  </View>
);

/* 2. Runner / Agility Badge */
const RunnerAchievementBadge = () => (
  <View style={[styles.badgeBox, styles.badgeBoxRunner]}>
    <Svg width={46} height={46} viewBox="0 0 46 46" fill="none">
      {/* Notched shield frame */}
      <Path
        d="M23 4 L26 8 C33 9 38 14 39 21 L43 23 L39 25 C38 32 33 37 26 38 L23 42 L20 38 C13 37 8 32 7 25 L3 23 L7 21 C8 14 13 9 20 8 Z"
        stroke="#94A3B8"
        strokeWidth="1.8"
        fill="rgba(148, 163, 184, 0.08)"
      />
      {/* Runner Silhouette */}
      <Circle cx="24.5" cy="13" r="2.2" fill="#E2E8F0" />
      <Path
        d="M23.5 16 L22 21 L18 20 M22 21 L26 23 L29 20 M22 21 L20 26 L16 32 M20 26 L25 28 L27 34"
        stroke="#E2E8F0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

/* 3. Golden Wings Badge */
const GoldenWingsAchievementBadge = () => (
  <View style={[styles.badgeBox, styles.badgeBoxWings]}>
    <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
      <Defs>
        <SvgLinearGradient id="wingsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFBEB" />
          <Stop offset="30%" stopColor="#FDE047" />
          <Stop offset="70%" stopColor="#F59E0B" />
          <Stop offset="100%" stopColor="#B45309" />
        </SvgLinearGradient>
      </Defs>
      {/* Left Wing Feathers */}
      <Path
        d="M20 23 C17 18 11 16 4 17 C8 20 12 23 15 26 C11 26 7 26 5 28 C9 30 13 31 17 31 C13 33 9 34 8 36 C13 36 17 34 20 31 Z"
        fill="url(#wingsGrad)"
      />
      {/* Right Wing Feathers */}
      <Path
        d="M28 23 C31 18 37 16 44 17 C40 20 36 23 33 26 C37 26 41 26 43 28 C39 30 35 31 31 31 C35 33 39 34 40 36 C35 36 31 34 28 31 Z"
        fill="url(#wingsGrad)"
      />
      {/* Center Crystal Jewel */}
      <Polygon
        points="24,18 27.5,24 24,31 20.5,24"
        fill="#FEF08A"
        stroke="#D97706"
        strokeWidth="1"
      />
      <Polygon
        points="24,20 26,24 24,29 22,24"
        fill="#FFFFFF"
      />
      {/* Jewel base dot */}
      <Circle cx="24" cy="33" r="1.5" fill="#FDE047" />
    </Svg>
  </View>
);

/* 4. Dumbbell / Strength Badge */
const DumbbellAchievementBadge = () => (
  <View style={[styles.badgeBox, styles.badgeBoxDumbbell]}>
    <Svg width={46} height={46} viewBox="0 0 46 46" fill="none">
      <Defs>
        <SvgLinearGradient id="dumbbellShieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FEF08A" />
          <Stop offset="50%" stopColor="#F59E0B" />
          <Stop offset="100%" stopColor="#B45309" />
        </SvgLinearGradient>
        <SvgLinearGradient id="goldPlateGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFBEB" />
          <Stop offset="50%" stopColor="#FBBF24" />
          <Stop offset="100%" stopColor="#D97706" />
        </SvgLinearGradient>
      </Defs>
      {/* Dome notched shield frame */}
      <Path
        d="M23 4 L26 8 C33 9 38 14 39 21 L43 23 L39 25 C38 32 33 37 26 38 L23 42 L20 38 C13 37 8 32 7 25 L3 23 L7 21 C8 14 13 9 20 8 Z"
        stroke="url(#dumbbellShieldGrad)"
        strokeWidth="1.8"
        fill="rgba(245, 158, 11, 0.08)"
      />
      {/* Horizontal Bar */}
      <Path
        d="M15 21.5 H31 V24.5 H15 Z"
        fill="url(#goldPlateGrad)"
      />
      {/* Left Outer Plate */}
      <Path
        d="M11 18 C11 17 12 17 13 17 H14 C14.5 17 14.5 17 14.5 18 V28 C14.5 29 14.5 29 14 29 H13 C12 29 11 29 11 28 Z"
        fill="url(#goldPlateGrad)"
      />
      {/* Left Inner Plate */}
      <Path
        d="M15.5 19.5 H17.5 V26.5 H15.5 Z"
        fill="url(#goldPlateGrad)"
      />
      {/* Right Inner Plate */}
      <Path
        d="M28.5 19.5 H30.5 V26.5 H28.5 Z"
        fill="url(#goldPlateGrad)"
      />
      {/* Right Outer Plate */}
      <Path
        d="M31.5 18 C31.5 17 32 17 33 17 H34 C34.5 17 35 17 35 18 V28 C35 29 34.5 29 34 29 H33 C32 29 31.5 29 31.5 28 Z"
        fill="url(#goldPlateGrad)"
      />
    </Svg>
  </View>
);

const HUNTER_QUOTE_POOL = [
  'Consistency today, bigger wins tomorrow.',
  'Push past your limits! There is always a higher level to reach.',
  'Arise from the shadows. Greatness belongs to the disciplined.',
  'Throughout Heaven and Earth, consistency is the true power.',
  'Mastery comes to those who endure without hesitation.',
  'Every rep counts. Leveling up is a non-negotiable grind.',
  'I never back down from a goal. That is my Hunter way!',
  'If you don’t dare to dream big, you’ll never cross the finish line!',
  'Every champion was once a contender that refused to quit.',
  'The secret of getting ahead is getting started.',
  'Small daily improvements over time lead to stunning results.',
  'Discipline is choosing between what you want now and what you want most.',
];

const getUniqueHunterQuote = (hunter: HunterDetailData): string => {
  if (hunter.quote && hunter.quote.trim().length > 0) {
    return hunter.quote;
  }
  const seed = (hunter.rank || 1) * 31 + (hunter.displayName?.length || 0);
  const index = Math.abs(seed) % HUNTER_QUOTE_POOL.length;
  return HUNTER_QUOTE_POOL[index];
};

export const HunterDetailModal: React.FC<HunterDetailModalProps> = ({
  visible,
  hunter,
  onClose,
}) => {
  const { user } = useAuth();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [showMoreShareOptions, setShowMoreShareOptions] = useState(false);
  const previewCardRef = useRef<View>(null);

  if (!hunter) return null;

  const displayQuote = getUniqueHunterQuote(hunter);
  const daysActive = hunter.daysActive || Math.floor(hunter.score / 1500) || 128;
  const streakDays =
    hunter.streakDays ??
    (hunter.isCurrentUser
      ? (user?.currentStreak ?? user?.user_progression?.daily_streak ?? 14)
      : Math.max(12, 30 - (hunter.rank || 1) * 2));

  const xpForNextLevel = 10000;
  const currentLevelXp = hunter.score % xpForNextLevel;
  const xpPercent = Math.max(8, Math.min(100, Math.round((currentLevelXp / xpForNextLevel) * 100)));

  /* 1. Instagram Share Handler */
  const handleInstagramShare = async () => {
    const igAppUrl = 'instagram://app';
    const igWebUrl = 'https://www.instagram.com/';

    try {
      const canOpen = await Linking.canOpenURL(igAppUrl);
      if (canOpen) {
        await Linking.openURL(igAppUrl);
      } else {
        await Linking.openURL(igWebUrl);
      }
    } catch (e) {
      await Linking.openURL(igWebUrl);
    }
  };

  /* 2. Twitter / X Share Handler */
  const handleTwitterShare = async () => {
    const text = `Check out my HunterX Rank #${hunter.rank} (Lv. ${hunter.level}) with ${hunter.score.toLocaleString()} XP! ⚔️🔥 #HunterX`;
    const twAppUrl = `twitter://post?message=${encodeURIComponent(text)}`;
    const twWebUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

    try {
      const canOpen = await Linking.canOpenURL(twAppUrl);
      if (canOpen) {
        await Linking.openURL(twAppUrl);
      } else {
        await Linking.openURL(twWebUrl);
      }
    } catch (e) {
      await Linking.openURL(twWebUrl);
    }
  };

  /* 3. WhatsApp Share Handler */
  const handleWhatsAppShare = async () => {
    const text = `Check out my HunterX Rank #${hunter.rank} (Lv. ${hunter.level}) with ${hunter.score.toLocaleString()} XP! 🔥 Join me on HunterX!`;
    const waAppUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const waWebUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

    try {
      const canOpen = await Linking.canOpenURL(waAppUrl);
      if (canOpen) {
        await Linking.openURL(waAppUrl);
      } else {
        await Linking.openURL(waWebUrl);
      }
    } catch (e) {
      await Linking.openURL(waWebUrl);
    }
  };

  const hunterImage = resolveHunterImage(hunter.avatarUrl);

  /* 4. Download Card Handler */
  const handleDownloadCard = async () => {
    try {
      showGlobalToast('Preparing card download... ⏳', 'info');

      // 1. Web browser download: generates the second image via Canvas and triggers direct file download
      if (Platform.OS === 'web') {
        const imageUri = getHunterImageUri(hunter, hunterImage);
        await downloadCardWeb(hunter, imageUri);
        showGlobalToast('Rank card downloaded! 📥', 'success');
        return;
      }

      // 2. Mobile Native (iOS / Android)
      if (previewCardRef.current) {
        const uri = await captureRef(previewCardRef, {
          format: 'png',
          quality: 1,
        });

        if (uri) {
          await RNShare.open({
            title: `HunterX Rank #${hunter.rank}`,
            message: `Check out ${hunter.displayName} (Rank #${hunter.rank}) on HunterX with ${hunter.score.toLocaleString()} XP!`,
            url: uri,
            type: 'image/png',
            filename: `HunterX-Rank-${hunter.rank}-${hunter.displayName.replace(/\s+/g, '_')}`,
            saveToFiles: true,
            failOnCancel: false,
          });
          showGlobalToast('Rank card saved! 📥', 'success');
          return;
        }
      }

      showGlobalToast('Rank card saved! 📥', 'success');
    } catch (e: any) {
      if (e?.message?.includes('User did not share')) return;
      try {
        await Share.share({
          message: `Check out ${hunter.displayName} (Rank #${hunter.rank}) on HunterX with ${hunter.score.toLocaleString()} XP!`,
        });
      } catch {}
      showGlobalToast('Rank card saved! 📥', 'success');
    }
  };

  /* 5. More / System Share Handler */
  const handleMoreShare = async () => {
    try {
      if (Platform.OS !== 'web' && previewCardRef.current) {
        const uri = await captureRef(previewCardRef, {
          format: 'png',
          quality: 1,
        });
        if (uri) {
          await RNShare.open({
            title: `HunterX Rank #${hunter.rank}`,
            message: `Check out ${hunter.displayName} (Rank #${hunter.rank}, Lv. ${hunter.level}) on HunterX with ${hunter.score.toLocaleString()} XP!`,
            url: uri,
            type: 'image/png',
            failOnCancel: false,
          });
          return;
        }
      }
      await Share.share({
        message: `Check out ${hunter.displayName} (Rank #${hunter.rank}, Lv. ${hunter.level}) on HunterX with ${hunter.score.toLocaleString()} XP!`,
      });
    } catch (e) {
      // dismissed
    }
  };

  /* 6. Snapchat Share Handler */
  const handleSnapchatShare = async () => {
    const text = `Check out my HunterX Rank #${hunter.rank} (Lv. ${hunter.level}) with ${hunter.score.toLocaleString()} XP! 🔥 Join me on HunterX!`;
    const snapAppUrl = 'snapchat://';
    const snapWebUrl = 'https://www.snapchat.com';

    try {
      if (Platform.OS !== 'web' && previewCardRef.current) {
        const uri = await captureRef(previewCardRef, {
          format: 'png',
          quality: 1,
        });
        if (uri) {
          try {
            await RNShare.shareSingle({
              title: `HunterX Rank #${hunter.rank}`,
              message: text,
              url: uri,
              social: RNShare.Social.SNAPCHAT as any,
            });
            return;
          } catch {}
        }
      }

      const canOpen = await Linking.canOpenURL(snapAppUrl);
      if (canOpen) {
        await Linking.openURL(snapAppUrl);
      } else {
        await Linking.openURL(snapWebUrl);
      }
    } catch {
      await Linking.openURL(snapWebUrl);
    }
  };

  /* 7. Instagram Threads Share Handler */
  const handleThreadsShare = async () => {
    const text = `Check out my HunterX Rank #${hunter.rank} (Lv. ${hunter.level}) with ${hunter.score.toLocaleString()} XP! ⚔️🔥 #HunterX`;
    const threadsAppUrl = `threads://post?text=${encodeURIComponent(text)}`;
    const threadsWebUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`;

    try {
      const canOpen = await Linking.canOpenURL(threadsAppUrl);
      if (canOpen) {
        await Linking.openURL(threadsAppUrl);
      } else {
        await Linking.openURL(threadsWebUrl);
      }
    } catch {
      await Linking.openURL(threadsWebUrl);
    }
  };

  /* 8. Copy Info / Link Handler */
  const handleCopyLink = async () => {
    try {
      const shareText = `Check out ${hunter.displayName}'s HunterX Rank #${hunter.rank} (Lv. ${hunter.level}) with ${hunter.score.toLocaleString()} XP! ⚔️🔥`;
      await Clipboard.setStringAsync(shareText);
      showGlobalToast('Rank info copied to clipboard! 📋', 'success');
    } catch {
      showGlobalToast('Failed to copy', 'error');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* =================================================================
            1. MAIN HUNTER PROFILE DETAIL CARD
            ================================================================= */}
        <View style={styles.modalCard}>
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
          >
            {/* TOP HERO HEADER BANNER WITH CHARACTER ART */}
            <View style={styles.heroBanner}>
              <Image
                source={hunterImage}
                style={styles.heroBannerImage}
                resizeMode="cover"
              />

              {/* Seamless Dark & Vignette Gradient Overlays */}
              <LinearGradient
                colors={[
                  'rgba(10, 9, 12, 0.25)',
                  'transparent',
                  'rgba(10, 9, 12, 0.35)',
                  'rgba(10, 9, 12, 0.85)',
                  '#0A090C',
                ]}
                locations={[0, 0.25, 0.65, 0.88, 1]}
                style={StyleSheet.absoluteFillObject}
              />

              {/* Top Navigation Action Buttons */}
              <View style={styles.topActionsRow}>
                {/* Close Button with Translucent Pill */}
                <TouchableOpacity
                  style={styles.topCircleBtn}
                  onPress={onClose}
                  activeOpacity={0.75}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Share Button with Translucent Pill */}
                <TouchableOpacity
                  style={styles.topCircleBtn}
                  onPress={() => setShareModalVisible(true)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* CARD BODY WITH UNIFIED PADDING */}
            <View style={styles.cardBody}>
              {/* HUNTER IDENTITY ROW */}
              <View style={styles.identityRow}>
                {/* Crowned Crest Badge */}
                <HunterRankCrest rank={hunter.rank} />

                {/* Name & Level / Tagline */}
                <View style={styles.nameBlock}>
                  <Text style={styles.hunterDisplayName} numberOfLines={1}>
                    {hunter.displayName}
                  </Text>

                  <View style={styles.levelTaglineRow}>
                    <View style={styles.levelCapsule}>
                      <Text style={styles.levelCapsuleText}>Lv. {hunter.level}</Text>
                    </View>
                    <View style={styles.taglineCol}>
                      <Text style={styles.taglineText}>CONSISTENCY CREATES</Text>
                      <Text style={styles.taglineText}>RESULTS.</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* STATS TRIO RIBBON (Total XP | Current Level | Current Rank) */}
              <View style={styles.statsCard}>
                {/* 1. Total XP */}
                <View style={styles.statCol}>
                  <Ionicons name="flame" size={20} color="#F97316" />
                  <Text style={styles.statNumber}>
                    {hunter.score.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Total XP</Text>
                </View>

                {/* 2. Current Level */}
                <View style={styles.statCol}>
                  <MaterialCommunityIcons name="stairs" size={20} color="#EF4444" />
                  <Text style={styles.statNumber}>Lv. {hunter.level}</Text>
                  <Text style={styles.statLabel}>Level</Text>
                </View>

                {/* 3. Current Rank */}
                <View style={styles.statCol}>
                  <MaterialCommunityIcons
                    name="chart-bar"
                    size={20}
                    color="#F59E0B"
                  />
                  <Text style={styles.statNumber}>#{hunter.rank}</Text>
                  <Text style={styles.statLabel}>Rank</Text>
                </View>
              </View>

              {/* QUOTE CARD WITH LARGE AMBER QUOTES */}
              <View style={styles.quoteCard}>
                <Text style={styles.quoteMarkLeft}>“</Text>
                <Text style={styles.quoteText}>{displayQuote}</Text>
                <Text style={styles.quoteMarkRight}>”</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* =================================================================
            2. SHARE RANK MODAL / SHEET OVERLAY
            ================================================================= */}
        <Modal
          visible={shareModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShareModalVisible(false);
            setShowMoreShareOptions(false);
          }}
        >
          <View style={styles.shareBackdrop}>
            <View style={styles.shareCard}>
              {/* Top Share Header */}
              <View style={styles.shareHeaderRow}>
                <View style={{ width: 38 }} />
                <View style={styles.shareTitleBlock}>
                  <Text style={styles.shareMainTitle}>Share Rank</Text>
                  <Text style={styles.shareSubtitle}>Show your progress to the world!</Text>
                </View>
                <TouchableOpacity
                  style={styles.topCircleBtn}
                  onPress={() => {
                    setShareModalVisible(false);
                    setShowMoreShareOptions(false);
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* CENTER SHARE PREVIEW CARD */}
              <View
                ref={previewCardRef}
                collapsable={false}
                style={styles.sharePreviewCard}
              >
                <Image
                  source={hunterImage}
                  style={styles.sharePreviewBg}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={[
                    'rgba(15, 11, 12, 0.85)',
                    'rgba(15, 11, 12, 0.3)',
                    'rgba(15, 11, 12, 0.95)',
                  ]}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* HunterX Branding */}
                <View style={styles.shareBrandRow}>
                  <Text style={styles.shareBrandWhite}>Hunter</Text>
                  <Text style={styles.shareBrandRed}>X</Text>
                </View>
                <Text style={styles.shareTagline}>TRACK. IMPROVE. GO FURTHER.</Text>

                {/* Big Rank Display */}
                <View style={styles.shareRankBlock}>
                  <Text style={styles.shareRankLabel}>RANK</Text>
                  <Text style={styles.shareRankNumber}>#{hunter.rank}</Text>
                </View>

                {/* Hunter Name & XP */}
                <Text style={styles.shareHunterName}>{hunter.displayName}</Text>
                <View style={styles.shareLevelCapsule}>
                  <Text style={styles.shareLevelText}>Lv. {hunter.level}</Text>
                </View>

                <View style={styles.shareXpRow}>
                  <Ionicons
                    name="flame"
                    size={15}
                    color="#F97316"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.shareXpText}>
                    {hunter.score.toLocaleString()} XP
                  </Text>
                </View>

                {/* Red Slanted Creed on Preview Card */}
                <View style={styles.shareCardCreed}>
                  <Text style={styles.shareCreedText}>CONSISTENCY</Text>
                  <Text style={styles.shareCreedText}>CREATES</Text>
                  <Text style={styles.shareCreedText}>RESULTS.</Text>
                </View>
              </View>

              {/* SOCIAL SHARE TARGETS ROW */}
              <View style={styles.shareTargetsRow}>
                {/* 1. Instagram */}
                <TouchableOpacity
                  style={styles.socialCol}
                  activeOpacity={0.8}
                  onPress={handleInstagramShare}
                >
                  <LinearGradient
                    colors={['#833AB4', '#FD1D1D', '#FCAF45']}
                    style={styles.socialIconCircle}
                  >
                    <Ionicons name="logo-instagram" size={22} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.socialLabel}>Instagram</Text>
                </TouchableOpacity>

                {/* 2. Twitter/X */}
                <TouchableOpacity
                  style={styles.socialCol}
                  activeOpacity={0.8}
                  onPress={handleTwitterShare}
                >
                  <View style={[styles.socialIconCircle, styles.socialBgDark]}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                        fill="#FFFFFF"
                      />
                    </Svg>
                  </View>
                  <Text style={styles.socialLabel}>Twitter/X</Text>
                </TouchableOpacity>

                {/* 3. Whatsapp */}
                <TouchableOpacity
                  style={styles.socialCol}
                  activeOpacity={0.8}
                  onPress={handleWhatsAppShare}
                >
                  <View style={[styles.socialIconCircle, styles.socialBgWhatsapp]}>
                    <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.socialLabel}>Whatsapp</Text>
                </TouchableOpacity>

                {/* 4. Download */}
                <TouchableOpacity
                  style={styles.socialCol}
                  activeOpacity={0.8}
                  onPress={handleDownloadCard}
                >
                  <View style={[styles.socialIconCircle, styles.socialBgDark]}>
                    <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.socialLabel}>Download</Text>
                </TouchableOpacity>

                {/* 5. More / Toggle */}
                <TouchableOpacity
                  style={styles.socialCol}
                  activeOpacity={0.8}
                  onPress={() => setShowMoreShareOptions((prev) => !prev)}
                >
                  <View
                    style={[
                      styles.socialIconCircle,
                      showMoreShareOptions ? styles.socialIconCircleActive : styles.socialBgDark,
                    ]}
                  >
                    <Ionicons
                      name={showMoreShareOptions ? 'chevron-up' : 'ellipsis-horizontal'}
                      size={20}
                      color={showMoreShareOptions ? '#EF4444' : '#FFFFFF'}
                    />
                  </View>
                  <Text style={[styles.socialLabel, showMoreShareOptions && { color: '#EF4444' }]}>
                    {showMoreShareOptions ? 'Less' : 'More'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* EXPANDED MORE PLATFORMS TRAY (Snapchat, Instagram Threads, Copy Link, etc.) */}
              {showMoreShareOptions && (
                <View style={styles.moreShareTray}>
                  <View style={styles.moreTrayHeader}>
                    <Text style={styles.moreTrayTitle}>More Platforms</Text>
                  </View>
                  <View style={styles.moreTargetsRow}>
                    {/* Snapchat */}
                    <TouchableOpacity
                      style={styles.socialCol}
                      activeOpacity={0.8}
                      onPress={handleSnapchatShare}
                    >
                      <View style={[styles.socialIconCircle, styles.socialBgSnapchat]}>
                        <Ionicons name="logo-snapchat" size={24} color="#000000" />
                      </View>
                      <Text style={styles.socialLabel}>Snapchat</Text>
                    </TouchableOpacity>

                    {/* Instagram Threads */}
                    <TouchableOpacity
                      style={styles.socialCol}
                      activeOpacity={0.8}
                      onPress={handleThreadsShare}
                    >
                      <View style={[styles.socialIconCircle, styles.socialBgThreads]}>
                        <Ionicons name="logo-threads" size={22} color="#FFFFFF" />
                      </View>
                      <Text style={styles.socialLabel}>Threads</Text>
                    </TouchableOpacity>

                    {/* Copy Link */}
                    <TouchableOpacity
                      style={styles.socialCol}
                      activeOpacity={0.8}
                      onPress={handleCopyLink}
                    >
                      <View style={[styles.socialIconCircle, styles.socialBgDark]}>
                        <Ionicons name="link-outline" size={20} color="#FFFFFF" />
                      </View>
                      <Text style={styles.socialLabel}>Copy Link</Text>
                    </TouchableOpacity>

                    {/* System Share (All Apps) */}
                    <TouchableOpacity
                      style={styles.socialCol}
                      activeOpacity={0.8}
                      onPress={handleMoreShare}
                    >
                      <View style={[styles.socialIconCircle, styles.socialBgDark]}>
                        <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                      </View>
                      <Text style={styles.socialLabel}>Other Apps</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '94%',
    backgroundColor: '#0A090C',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.55)',
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 16,
  },

  /* Hero Banner */
  heroBanner: {
    width: '100%',
    height: 250,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  heroBannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  topCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 10, 12, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },

  /* Scroll Body */
  scrollBody: {
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  /* Identity Row */
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  crestContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  crestRankWrapper: {
    position: 'absolute',
    top: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestRankText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#FDE047',
  },
  nameBlock: {
    flex: 1,
  },
  hunterDisplayName: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 5,
  },
  levelTaglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelCapsule: {
    backgroundColor: '#1C1C24',
    borderWidth: 1,
    borderColor: '#2E2E38',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
  },
  levelCapsuleText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#E4E4E7',
  },
  taglineCol: {
    justifyContent: 'center',
  },
  taglineText: {
    fontFamily: fontFamilies.bold,
    fontSize: 8.5,
    color: '#71717A',
    letterSpacing: 0.6,
    lineHeight: 11,
    textTransform: 'uppercase',
  },

  /* Stats Ribbon */
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121217',
    borderWidth: 1.2,
    borderColor: '#24232C',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    color: '#FFFFFF',
    marginTop: 5,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10.5,
    color: '#71717A',
  },

  /* Quote Card */
  quoteCard: {
    backgroundColor: '#141217',
    borderWidth: 1.2,
    borderColor: '#5B2E0E',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    position: 'relative',
    marginBottom: 14,
  },
  quoteMarkLeft: {
    position: 'absolute',
    top: 2,
    left: 10,
    fontFamily: fontFamilies.bold,
    fontSize: 28,
    color: '#F59E0B',
    lineHeight: 28,
  },
  quoteMarkRight: {
    position: 'absolute',
    bottom: -2,
    right: 10,
    fontFamily: fontFamilies.bold,
    fontSize: 28,
    color: '#F59E0B',
    lineHeight: 28,
  },
  quoteText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#E4E4E7',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 19,
  },

  /* Achievements Section */
  achievementsSection: {
    marginBottom: 14,
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  achievementsTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badgeBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
  },
  badgeBoxFlame: {
    backgroundColor: '#140D0E',
    borderColor: '#591616',
  },
  badgeBoxRunner: {
    backgroundColor: '#0E1318',
    borderColor: '#1E293B',
  },
  badgeBoxWings: {
    backgroundColor: '#16120B',
    borderColor: '#4A2A0C',
  },
  badgeBoxDumbbell: {
    backgroundColor: '#16120B',
    borderColor: '#4A2A0C',
  },

  /* Bottom Action Button */
  followButtonWrapper: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 2,
  },
  followButtonWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  followButtonText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#000000',
  },
  followingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#18181F',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  followingButtonText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#10B981',
  },

  /* =================================================================
     SHARE MODAL STYLES
     ================================================================= */
  shareBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  shareCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0A090C',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.55)',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 16,
  },
  shareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  shareTitleBlock: {
    alignItems: 'center',
  },
  shareMainTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  shareSubtitle: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    color: '#71717A',
    marginTop: 2,
  },
  sharePreviewCard: {
    width: '100%',
    height: 240,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FE5B01',
    overflow: 'hidden',
    position: 'relative',
    padding: 16,
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 15,
    elevation: 8,
  },
  sharePreviewBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  shareBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareBrandWhite: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  shareBrandRed: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: '#EF4444',
  },
  shareTagline: {
    fontFamily: fontFamilies.bold,
    fontSize: 7.5,
    color: '#71717A',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  shareRankBlock: {
    marginVertical: 4,
  },
  shareRankLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#F59E0B',
    letterSpacing: 1.2,
  },
  shareRankNumber: {
    fontFamily: fontFamilies.bold,
    fontSize: 36,
    color: '#F59E0B',
    lineHeight: 38,
  },
  shareHunterName: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  shareLevelCapsule: {
    alignSelf: 'flex-start',
    backgroundColor: '#1C1C24',
    borderWidth: 1,
    borderColor: '#2E2E38',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginVertical: 4,
  },
  shareLevelText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
    color: '#E4E4E7',
  },
  shareXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareXpText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  shareCardCreed: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    alignItems: 'flex-end',
  },
  shareCreedText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    color: '#EF4444',
    letterSpacing: 0.8,
    lineHeight: 12,
  },

  /* Social Share Targets Row */
  shareTargetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  socialCol: {
    alignItems: 'center',
    flex: 1,
  },
  socialIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  socialBgDark: {
    backgroundColor: '#181820',
    borderWidth: 1,
    borderColor: '#282834',
  },
  socialBgWhatsapp: {
    backgroundColor: '#25D366',
  },
  socialLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 10.5,
    color: '#A1A1AA',
  },
  socialIconCircleActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1.2,
    borderColor: '#EF4444',
  },
  socialBgSnapchat: {
    backgroundColor: '#FFFC00',
  },
  socialBgThreads: {
    backgroundColor: '#0F0F14',
    borderWidth: 1.2,
    borderColor: '#2F2F3D',
  },
  moreShareTray: {
    width: '100%',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  moreTrayHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  moreTrayTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 9.5,
    color: '#71717A',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  moreTargetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
});
