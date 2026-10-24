import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  Animated,
  TouchableOpacity,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path,
  Defs,
  Mask,
  Rect,
  Circle,
  G,
  Text as SvgText,
  LinearGradient as SvgGradient,
  RadialGradient,
  Stop,
  Image as SvgImage,
} from 'react-native-svg';
import { fontFamilies } from '../../theme/typography';
import { TopographyPattern } from '../ui/TopographyPattern';
import { RewardProductImage, REWARD_IMAGE_WIDTH } from './reward/RewardProductImage';

const HUNTERX_TITLE = require('../../assets/images/hunterx_card_title.png');
const HUNTER_REWARD_GEM = require('../../assets/images/hunterx_reward_emblem.webp');

export type ScratchRarity = 'legendary' | 'epic' | 'rare' | 'common';

/**
 * Where the prize under the foil is:
 * - locked: not asked for yet; the first touch calls onScratchStart.
 * - loading: being fetched; the foil stays whole and can't be scratched off.
 * - ready: drawn under the foil; scratching reveals it.
 * - error: the request failed; the foil is restored, the next touch asks again.
 */
export type ScratchCardStatus = 'locked' | 'loading' | 'ready' | 'error';

export interface ScratchCardProps {
  onComplete?: () => void;
  isScratched?: boolean;
  /** Defaults to 'ready' (prize passed in up front, e.g. dev screens). */
  status?: ScratchCardStatus;
  /** First touch of an unscratched card while it isn't 'ready': fetch the prize. */
  onScratchStart?: () => void;
  rewardText?: string;
  rewardSubtitle?: string;
  rewardValue?: string;
  productName?: string;
  productCategory?: string;
  productImageUrl?: string;
  code?: string;
  rarity?: ScratchRarity;
  /** Brand badge in the top-left corner; none when not given. */
  iconName?: 'amazon' | keyof typeof MaterialCommunityIcons.glyphMap;
  width?: number;
  height?: number;
  autoRevealThreshold?: number; // 0.0 to 1.0 (e.g. 0.50 = 50%)
}

/** Sample prize for dev/test screens only — real cards get theirs from the backend. */
export const SCRATCH_CARD_DEMO_PRIZE: Pick<
  ScratchCardProps,
  'rewardText' | 'rewardSubtitle' | 'productName' | 'productCategory' | 'code' | 'iconName'
> = {
  rewardText: '$25 AMAZON VOUCHER',
  rewardSubtitle: 'on Amazon Fitness orders above ₹800',
  productName: 'Pro Resistance Bands Set',
  productCategory: 'Strength & Mobility Kit',
  code: 'AMZ-BAND-25',
  iconName: 'amazon',
};

interface Point {
  x: number;
  y: number;
}

const GRID_COLS = 8;
const GRID_ROWS = 10;
const TOTAL_GRID_CELLS = GRID_COLS * GRID_ROWS;

const RARITY_THEMES: Record<
  ScratchRarity,
  {
    borderColor: string;
    glowColor: string;
    badgeBg: string;
    textColor: string;
    gradientColors: [string, string, string];
    badgeLabel: string;
  }
> = {
  legendary: {
    borderColor: '#FE5B01',
    glowColor: 'rgba(254, 91, 1, 0.45)',
    badgeBg: 'rgba(254, 91, 1, 0.18)',
    textColor: '#FE5B01',
    gradientColors: ['#16181C', '#121316', '#0E0F12'],
    badgeLabel: 'LEGENDARY LOOT',
  },
  epic: {
    borderColor: '#C084FC',
    glowColor: 'rgba(192, 132, 252, 0.45)',
    badgeBg: 'rgba(192, 132, 252, 0.18)',
    textColor: '#E9D5FF',
    gradientColors: ['#16181C', '#141318', '#0E0F12'],
    badgeLabel: 'EPIC DROP',
  },
  rare: {
    borderColor: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    badgeBg: 'rgba(56, 189, 248, 0.18)',
    textColor: '#BAE6FD',
    gradientColors: ['#16181C', '#10141A', '#0E0F12'],
    badgeLabel: 'RARE REWARD',
  },
  common: {
    borderColor: '#34D399',
    glowColor: 'rgba(52, 211, 153, 0.35)',
    badgeBg: 'rgba(52, 211, 153, 0.15)',
    textColor: '#A7F3D0',
    gradientColors: ['#16181C', '#101815', '#0E0F12'],
    badgeLabel: 'HUNTER LOOT',
  },
};

export const ScratchCard: React.FC<ScratchCardProps> = ({
  onComplete,
  isScratched = false,
  status = 'ready',
  onScratchStart,
  rewardText,
  rewardSubtitle,
  productName,
  productImageUrl,
  code,
  iconName,
  rarity = 'legendary',
  width = 300,
  height = 460,
  autoRevealThreshold = 0.50,
}) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [isRevealed, setIsRevealed] = useState(isScratched);
  const [copied, setCopied] = useState(false);

  const currentPathRef = useRef<string>('');
  const revealAnim = useRef(new Animated.Value(isScratched ? 0 : 1)).current;
  const gridCellsRef = useRef<Set<number>>(new Set());
  const isRevealedRef = useRef(isScratched);

  // The pan handlers below are created once, so they read these through refs.
  const statusRef = useRef(status);
  statusRef.current = status;
  const onScratchStartRef = useRef(onScratchStart);
  onScratchStartRef.current = onScratchStart;
  // Read at reveal time: the caller's callback closes over the card it had
  // when rendered, and the prize only arrives after the first touch.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Until the prize is drawn the foil has to stay whole: wipe any strokes
  // made while it was loading, and again if the request failed.
  useEffect(() => {
    if (status === 'ready') return;
    currentPathRef.current = '';
    gridCellsRef.current = new Set();
    setPaths([]);
    setPoints([]);
  }, [status]);

  const theme = RARITY_THEMES[rarity] || RARITY_THEMES.legendary;
  const emblemWidth = Math.round(width * 0.48);
  const emblemHeight = Math.round(emblemWidth * (839 / 857));
  const titleWidth = Math.round(width * 0.54);
  const titleHeight = Math.round(titleWidth / 3.30);
  const titleTop = Math.round(height * 0.07);

  const triggerReveal = () => {
    if (isRevealedRef.current) return;
    isRevealedRef.current = true;
    setIsRevealed(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Clean fade out of remaining foil coating
    Animated.timing(revealAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onCompleteRef.current?.();
    });
  };

  const checkGridCell = (x: number, y: number) => {
    const colWidth = width / GRID_COLS;
    const rowHeight = height / GRID_ROWS;
    const col = Math.floor(x / colWidth);
    const row = Math.floor(y / rowHeight);
    const cellId = Math.min(TOTAL_GRID_CELLS - 1, Math.max(0, row * GRID_COLS + col));

    if (!gridCellsRef.current.has(cellId)) {
      gridCellsRef.current.add(cellId);
      const clearedRatio = gridCellsRef.current.size / TOTAL_GRID_CELLS;

      if (clearedRatio >= autoRevealThreshold && !isRevealedRef.current) {
        triggerReveal();
      }
    }
  };

  const handleTouchStart = (evt: GestureResponderEvent) => {
    if (isRevealedRef.current) return;

    // No prize under the foil yet: ask for it, and don't scratch meanwhile.
    if (statusRef.current !== 'ready') {
      if (statusRef.current !== 'loading') onScratchStartRef.current?.();
      return;
    }

    const { locationX, locationY } = evt.nativeEvent;
    const clampedX = Math.max(0, Math.min(width, locationX));
    const clampedY = Math.max(0, Math.min(height, locationY));

    currentPathRef.current = `M ${clampedX.toFixed(1)} ${clampedY.toFixed(1)}`;

    setPaths((prev) => [...prev, currentPathRef.current]);
    setPoints((prev) => [...prev.slice(-80), { x: clampedX, y: clampedY }]);

    checkGridCell(clampedX, clampedY);
  };

  const handleTouchMove = (evt: GestureResponderEvent) => {
    if (isRevealedRef.current) return;
    // Started on a loading card that has since become ready: begin a stroke here.
    if (statusRef.current !== 'ready') return;
    if (!currentPathRef.current) {
      handleTouchStart(evt);
      return;
    }

    const { locationX, locationY } = evt.nativeEvent;
    const clampedX = Math.max(0, Math.min(width, locationX));
    const clampedY = Math.max(0, Math.min(height, locationY));

    currentPathRef.current += ` L ${clampedX.toFixed(1)} ${clampedY.toFixed(1)}`;

    setPaths((prev) => {
      if (prev.length === 0) return [currentPathRef.current];
      const next = [...prev];
      next[next.length - 1] = currentPathRef.current;
      return next;
    });

    setPoints((prev) => [...prev.slice(-80), { x: clampedX, y: clampedY }]);
    checkGridCell(clampedX, clampedY);
  };

  const handleTouchEnd = () => {
    currentPathRef.current = '';
    if (statusRef.current !== 'ready') return;
    if (gridCellsRef.current.size >= 4 && !isRevealedRef.current) {
      const clearedRatio = gridCellsRef.current.size / TOTAL_GRID_CELLS;
      if (clearedRatio >= 0.2) {
        triggerReveal();
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: handleTouchStart,
      onPanResponderMove: handleTouchMove,
      onPanResponderRelease: handleTouchEnd,
    })
  ).current;

  const handleCopy = () => {
    if (!code) return;
    Clipboard.setString(code);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <View
      style={[
        styles.cardOuterFrame,
        {
          width,
          height,
          borderColor: '#FE5B01',
        },
      ]}
    >
      <View style={[styles.cardContainer, { width, height }]}>
        {/* REVEALED REWARD SURFACE: MATCHING GOOGLE PAY REFERENCE SCREENSHOT */}
        {/* Drawn only once the prize has arrived, so nothing sits under the foil before. */}
        {(status === 'ready' || isScratched) && (
        <View style={styles.revealedSurface}>
          <View style={styles.revealedContainer}>
            {/* 1. TOP HALF: HERO PRODUCT IMAGE */}
            <View style={styles.topImageSection}>
              <RewardProductImage uri={productImageUrl} width={REWARD_IMAGE_WIDTH.scratchCard} />

              {/* Top-Left Circular Brand Badge */}
              {iconName && (
                <View style={styles.brandCircleBadge}>
                  {iconName === 'amazon' ? (
                    <FontAwesome5 name="amazon" size={15} color="#0D0F12" />
                  ) : (
                    <MaterialCommunityIcons name={iconName} size={16} color="#0D0F12" />
                  )}
                </View>
              )}

              {/* Top-Right Tag Badge */}
              <View style={styles.topRightTagBadge}>
                <Text style={styles.topRightTagText}>New</Text>
              </View>
            </View>

            {/* 2. BOTTOM HALF: CLEAN DARK OFFER DETAILS */}
            <View style={styles.bottomInfoSection}>
              <View>
                <Text style={styles.offerMainHeading} numberOfLines={1}>
                  {rewardText}
                </Text>
                {!!rewardSubtitle && (
                  <Text style={styles.offerSubtext} numberOfLines={1}>
                    {rewardSubtitle}
                  </Text>
                )}
                {!!productName && (
                  <Text style={styles.productNameText} numberOfLines={1}>
                    {productName}
                  </Text>
                )}
              </View>

              {/* Code Snippet Box */}
              {code && (
                <TouchableOpacity
                  style={styles.codeSnippetBox}
                  onPress={handleCopy}
                  activeOpacity={0.8}
                >
                  <View style={styles.codeTextCol}>
                    <Text style={styles.codeSnippetLabel}>CLAIM CODE</Text>
                    <Text style={styles.codeSnippetVal}>{code}</Text>
                  </View>
                  <View style={styles.copyPillBtn}>
                    <MaterialCommunityIcons
                      name={copied ? 'check' : 'content-copy'}
                      size={12}
                      color="#0D0F12"
                    />
                    <Text style={styles.copyPillBtnText}>{copied ? 'COPIED' : 'COPY'}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        )}

        {/* TOP FOIL LAYER WITH NATURAL MASK SCRATCH (Clean Google Pay Style) */}
        {!isRevealed && (
          <Animated.View
            style={[styles.foilCoating, { opacity: revealAnim }]}
            {...panResponder.panHandlers}
          >
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              <Defs>
                {/* Natural Erasing Mask: White shows foil, Black erases/transparent */}
                <Mask id="scratchFoilMask">
                  <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
                  {paths.map((p, index) => (
                    <Path
                      key={`p-${index}`}
                      d={p}
                      stroke="#000000"
                      strokeWidth={44}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}
                  {points.map((pt, index) => (
                    <Circle
                      key={`pt-${index}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={22}
                      fill="#000000"
                    />
                  ))}
                </Mask>

                {/* Foil Background */}
                <SvgGradient id="foilBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#16181C" />
                  <Stop offset="50%" stopColor="#121316" />
                  <Stop offset="100%" stopColor="#0E0F12" />
                </SvgGradient>

                {/* Subtle top orange reflection */}
                <SvgGradient id="topOrangeReflection" x1="10%" y1="0%" x2="40%" y2="25%">
                  <Stop offset="0%" stopColor="#FE5B01" stopOpacity="0.05" />
                  <Stop offset="100%" stopColor="#FE5B01" stopOpacity="0" />
                </SvgGradient>

                {/* Topo line gradients */}
                <SvgGradient id="topoGreyClean" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#2A2C33" stopOpacity="0.85" />
                  <Stop offset="50%" stopColor="#212328" stopOpacity="0.7" />
                  <Stop offset="100%" stopColor="#181A1E" stopOpacity="0.55" />
                </SvgGradient>

                <SvgGradient id="topoGreySubtle" x1="0%" y1="100%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#23252A" stopOpacity="0.6" />
                  <Stop offset="50%" stopColor="#2A2C33" stopOpacity="0.75" />
                  <Stop offset="100%" stopColor="#1A1C20" stopOpacity="0.5" />
                </SvgGradient>

                {/* HunterX Emblem Gradients */}
                <RadialGradient id="xBackAura" cx="50%" cy="50%" r="42%">
                  <Stop offset="0%" stopColor="#FE5B01" stopOpacity="0.22" />
                  <Stop offset="60%" stopColor="#B94F24" stopOpacity="0.05" />
                  <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </RadialGradient>
                <SvgGradient id="gradWingHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFAC66" />
                  <Stop offset="40%" stopColor="#FF9438" />
                  <Stop offset="100%" stopColor="#FE5B01" />
                </SvgGradient>
                <SvgGradient id="gradWingBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FE5B01" />
                  <Stop offset="50%" stopColor="#DF5714" />
                  <Stop offset="100%" stopColor="#9E350A" />
                </SvgGradient>
                <SvgGradient id="gradMainSlash" x1="100%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#FFAA66" />
                  <Stop offset="25%" stopColor="#FE5B01" />
                  <Stop offset="65%" stopColor="#E05A18" />
                  <Stop offset="100%" stopColor="#A6380A" />
                </SvgGradient>
                <SvgGradient id="gradSlashShadow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#E05A18" />
                  <Stop offset="50%" stopColor="#B94F24" />
                  <Stop offset="100%" stopColor="#692005" />
                </SvgGradient>
                <SvgGradient id="gradFootShadow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#B94F24" />
                  <Stop offset="50%" stopColor="#8A2E07" />
                  <Stop offset="100%" stopColor="#4D1602" />
                </SvgGradient>
              </Defs>

              {/* Entire Foil Surface inside Mask */}
              <G mask="url(#scratchFoilMask)">
                {/* 1. Dark Grey Background */}
                <Rect x={0} y={0} width={width} height={height} fill="url(#foilBgGrad)" />
                <Rect x={0} y={0} width={width} height={height} fill="url(#topOrangeReflection)" />

                {/* 2. Topography Contour Lines */}
                <G transform={`scale(${width / 240}, ${height / 360})`}>
                  <Path d="M -20 15 C 20 25, 45 10, 75 35 C 105 60, 95 95, 130 110 C 165 125, 210 100, 260 115" stroke="url(#topoGreyClean)" strokeWidth="1.1" fill="none" />
                  <Path d="M -20 35 C 25 45, 50 28, 85 52 C 120 76, 110 112, 145 128 C 180 144, 220 120, 260 135" stroke="url(#topoGreyClean)" strokeWidth="1" fill="none" />
                  <Path d="M -15 60 C 30 70, 60 50, 95 72 C 130 94, 125 130, 160 146 C 195 162, 230 140, 260 155" stroke="url(#topoGreySubtle)" strokeWidth="1" fill="none" />
                  <Path d="M -10 85 C 35 95, 70 72, 105 92 C 140 112, 140 150, 175 166 C 210 182, 240 160, 260 175" stroke="url(#topoGreyClean)" strokeWidth="1" fill="none" />
                  <Path d="M 15 130 C 50 140, 80 120, 115 138 C 150 156, 155 190, 190 204 C 225 218, 245 195, 260 210" stroke="url(#topoGreySubtle)" strokeWidth="1" fill="none" />
                  <Path d="M -10 160 C 35 170, 75 148, 110 165 C 145 182, 160 215, 195 230 C 230 245, 245 225, 260 240" stroke="url(#topoGreyClean)" strokeWidth="1" fill="none" />
                  <Path d="M 120 155 C 80 145, 60 180, 85 215 C 110 250, 160 240, 175 205 C 190 170, 160 165, 120 155 Z" stroke="url(#topoGreyClean)" strokeWidth="1" fill="none" />
                  <Path d="M 120 140 C 65 130, 45 190, 75 230 C 105 270, 175 260, 190 215 C 205 170, 175 150, 120 140 Z" stroke="url(#topoGreySubtle)" strokeWidth="1" fill="none" />
                  <Path d="M 120 125 C 50 115, 30 200, 65 245 C 100 290, 190 280, 205 225 C 220 170, 190 135, 120 125 Z" stroke="url(#topoGreyClean)" strokeWidth="1" fill="none" />
                  <Path d="M -20 220 C 20 230, 50 210, 85 235 C 120 260, 130 300, 165 315 C 200 330, 235 305, 260 320" stroke="url(#topoGreySubtle)" strokeWidth="1" fill="none" />
                  <Path d="M -20 250 C 25 260, 60 238, 95 260 C 130 282, 145 320, 180 335 C 215 350, 240 325, 260 340" stroke="url(#topoGreyClean)" strokeWidth="1" fill="none" />
                  <Path d="M -10 280 C 35 290, 70 268, 105 288 C 140 308, 160 340, 195 355 C 230 370, 245 345, 260 360" stroke="url(#topoGreySubtle)" strokeWidth="1" fill="none" />
                  <Path d="M 5 310 C 50 320, 85 295, 120 315 C 155 335, 175 365, 210 380" stroke="url(#topoGreyClean)" strokeWidth="1" fill="none" />
                </G>

                {/* 3. Top Center Stylized "HUNTER X" Title Logo */}
                <SvgImage
                  href={HUNTERX_TITLE}
                  x={(width - titleWidth) / 2}
                  y={titleTop}
                  width={titleWidth}
                  height={titleHeight}
                  preserveAspectRatio="xMidYMid meet"
                />

                {/* 4. Center Elemental Mana Core Crystal Emblem */}
                <SvgImage
                  href={HUNTER_REWARD_GEM}
                  x={(width - emblemWidth) / 2}
                  y={(height - emblemHeight) / 2 + 10}
                  width={emblemWidth}
                  height={emblemHeight}
                  preserveAspectRatio="xMidYMid meet"
                />

                {/* 4. Bottom "DRAG TO SCRATCH" Footer Text */}
                <SvgText
                  x={width / 2}
                  y={height - 20}
                  fill="#F2F2F2"
                  fontSize={7.5}
                  letterSpacing={1.2}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  DRAG TO SCRATCH
                </SvgText>
              </G>
            </Svg>
            {status === 'loading' && (
              <View style={styles.loadingPill} pointerEvents="none">
                <ActivityIndicator size="small" color="#FE5B01" />
                <Text style={styles.loadingPillText}>Revealing...</Text>
              </View>
            )}
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardOuterFrame: {
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: '#16181C',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
  },
  cardContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  revealedSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  revealedContainer: {
    flex: 1,
    backgroundColor: '#121316',
  },
  topImageSection: {
    width: '100%',
    height: '54%',
    position: 'relative',
    backgroundColor: '#1A1C20',
    overflow: 'hidden',
  },
  brandCircleBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  topRightTagBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#154726',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  topRightTagText: {
    fontFamily: fontFamilies.bold,
    color: '#4ADE80',
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  bottomInfoSection: {
    width: '100%',
    height: '46%',
    backgroundColor: '#121316',
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  offerMainHeading: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  offerSubtext: {
    fontFamily: fontFamilies.regular,
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  productNameText: {
    fontFamily: fontFamilies.semiBold,
    color: '#FF9900',
    fontSize: 11.5,
    marginTop: 2,
  },
  codeSnippetBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1E23',
    borderWidth: 1,
    borderColor: '#2A2C33',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  codeTextCol: {
    flex: 1,
  },
  codeSnippetLabel: {
    fontFamily: fontFamilies.bold,
    color: '#6B7280',
    fontSize: 7.5,
    letterSpacing: 0.5,
  },
  codeSnippetVal: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  copyPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FE5B01',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyPillBtnText: {
    fontFamily: fontFamilies.bold,
    color: '#0D0F12',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  foilCoating: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  loadingPill: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(13, 15, 18, 0.85)',
    borderWidth: 1,
    borderColor: '#2A2C33',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  loadingPillText: {
    fontFamily: fontFamilies.semiBold,
    color: '#F2F2F2',
    fontSize: 11,
    letterSpacing: 0.4,
  },
});

