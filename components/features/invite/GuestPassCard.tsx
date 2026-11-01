import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  type LayoutRectangle,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import QRCode from "react-native-qrcode-svg";

import ViewShot from "@/components/common/ViewShotCompat";
import { Skeleton } from "@/components/common/Skeleton";
import { CLOUDINARY_ASSETS } from "@/constants/cloudinaryAssets";
import {
  DEFAULT_BLURHASH,
  optimizeCloudinaryUrl,
} from "@/services/media/cloudinary";
import type { ViewShotHandle } from "@/types/viewShot";
import { fontFamilies } from "@/theme/typography";
import { INVITE_COPY, inviteLink, spokenCode } from "./inviteCopy";

const CARD_HEIGHT = 245;
const TOP_ROW_INSET = 12;
// Drawn size is QR_SIZE plus the quiet zone on each side.
const QR_SIZE = 150;
const FLIP_MS = 520;

export type GuestPassCardHandle = {
  /** Turns the card to that side (if needed) and returns a PNG of it. */
  capture: (side: "pass" | "qr") => Promise<string | undefined>;
};

type GuestPassCardProps = {
  /** null while the profile (or the offline cache) hasn't produced one yet. */
  code: string | null;
  issuerName?: string;
  onCopyCode?: () => void;
  onShareQr?: () => void;
};

/**
 * The guest pass: anime art on the front, the invite link as a QR code on
 * the back. Tapping turns it over.
 */
export const GuestPassCard = forwardRef<
  GuestPassCardHandle,
  GuestPassCardProps
>(function GuestPassCard({ code, issuerName, onCopyCode, onShareQr }, ref) {
  const reduceMotion = useReducedMotion();
  const [showingQr, setShowingQr] = useState(false);
  const passShotRef = useRef<ViewShotHandle>(null);
  // Where "Code : …" sits in the top row, for the copy button laid over it.
  const [codeBox, setCodeBox] = useState<LayoutRectangle | null>(null);
  const qrShotRef = useRef<ViewShotHandle>(null);

  // 0 = front, 180 = back.
  const rotation = useSharedValue(0);
  const scan = useSharedValue(0);
  const glow = useSharedValue(0.25);

  useEffect(() => {
    if (reduceMotion) return;
    scan.value = withRepeat(
      withTiming(135, { duration: 3400, easing: Easing.linear }),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 2200 }),
        withTiming(0.25, { duration: 2200 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(scan);
      cancelAnimation(glow);
    };
  }, [reduceMotion, scan, glow]);

  const turnTo = (qr: boolean) => {
    setShowingQr(qr);
    const target = qr ? 180 : 0;
    rotation.value = reduceMotion
      ? target
      : withTiming(target, {
          duration: FLIP_MS,
          easing: Easing.out(Easing.cubic),
        });
  };

  useImperativeHandle(ref, () => ({
    capture: async (side) => {
      const wantQr = side === "qr";
      if (showingQr !== wantQr) {
        turnTo(wantQr);
        await new Promise((resolve) =>
          setTimeout(resolve, reduceMotion ? 50 : FLIP_MS + 40),
        );
      }
      return (wantQr ? qrShotRef : passShotRef).current?.capture?.();
    },
  }));

  // Opacity switches at the halfway point too, since Android doesn't always
  // honour backfaceVisibility.
  const frontStyle = useAnimatedStyle(() => ({
    opacity: rotation.value < 90 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: rotation.value >= 90 ? 1 : 0,
    transform: [
      { perspective: 1200 },
      { rotateY: `${rotation.value + 180}deg` },
    ],
  }));
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value }],
    opacity: interpolate(
      scan.value,
      [0, 15, 100, 115],
      [0, 0.25, 0.25, 0],
      "clamp",
    ),
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const link = code ? inviteLink(code) : null;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glowLayer, glowStyle]} />
      <Pressable
        onPress={() => turnTo(!showingQr)}
        disabled={!code}
        accessibilityRole="button"
        accessibilityLabel={
          showingQr && link
            ? INVITE_COPY.cardA11yBack(link)
            : `${INVITE_COPY.cardA11yFront}${code ? ` ${INVITE_COPY.codeLabel}: ${spokenCode(code)}` : ""}`
        }
        style={styles.pressable}
      >
        {/* Front: the guest pass */}
        <Animated.View style={[styles.face, frontStyle]} pointerEvents="none">
          <ViewShot
            ref={passShotRef}
            options={{ format: "png", quality: 1 }}
            style={styles.frontShot}
          >
            <Image
              source={{
                uri: optimizeCloudinaryUrl(CLOUDINARY_ASSETS.refer_bg.uri),
              }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              placeholder={{ blurhash: DEFAULT_BLURHASH }}
              transition={150}
            />

            {reduceMotion ? null : (
              <Animated.View style={[styles.scanLine, scanStyle]}>
                <LinearGradient
                  colors={[
                    "rgba(254, 91, 1, 0)",
                    "rgba(254, 91, 1, 0.25)",
                    "rgba(254, 91, 1, 0)",
                  ]}
                  style={styles.scanLineGlow}
                />
                <View style={styles.scanLineCore} />
              </Animated.View>
            )}

            <LinearGradient
              colors={[
                "rgba(10, 15, 30, 0.45)",
                "rgba(6, 10, 22, 0.65)",
                "rgba(10, 18, 36, 0.85)",
              ]}
              style={styles.overlay}
            >
              <View style={styles.topRow}>
                <View style={styles.rarityBadge}>
                  <View style={styles.starCircle}>
                    <Ionicons name="star" size={7} color="#0E1116" />
                  </View>
                  <Text style={styles.rarityText}>{INVITE_COPY.passBadge}</Text>
                </View>
                {code ? (
                  <View
                    style={styles.codeCopy}
                    onLayout={(e) => setCodeBox(e.nativeEvent.layout)}
                  >
                    <Text style={styles.codeText}>
                      {INVITE_COPY.passCode(code)}
                    </Text>
                    {onCopyCode ? (
                      <Ionicons name="copy-outline" size={12} color="#38BDF8" />
                    ) : null}
                  </View>
                ) : (
                  <Skeleton width={80} height={10} borderRadius={4} />
                )}
              </View>

              <View style={styles.centerText}>
                <Text style={styles.mainTitle}>{INVITE_COPY.passTitle}</Text>
                <Text style={styles.subTitle}>{INVITE_COPY.passSubtitle}</Text>
              </View>

              <View style={styles.footerRow}>
                <Brand />
                {issuerName ? (
                  <View style={styles.issuerBadge}>
                    <Text style={styles.issuerText} numberOfLines={1}>
                      {INVITE_COPY.passIssuedBy(issuerName)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          </ViewShot>
          <View style={styles.flipIcon}>
            <Ionicons name="qr-code-outline" size={14} color="#FFFFFF" />
          </View>
        </Animated.View>

        {/* Back: the QR code. The ViewShot inside has no transform of its own, so captures come out upright. */}
        <Animated.View
          style={[styles.face, styles.backFace, backStyle]}
          pointerEvents="none"
        >
          <ViewShot
            ref={qrShotRef}
            options={{ format: "png", quality: 1 }}
            style={styles.backShot}
          >
            <View style={styles.backContent}>
              <View style={styles.qrFrame}>
                {link ? (
                  <QRCode
                    value={link}
                    size={QR_SIZE}
                    color="#FFFFFF"
                    backgroundColor="#000000"
                    quietZone={10}
                    ecl="M"
                  />
                ) : null}
              </View>
              <View style={styles.backText}>
                <Text style={styles.backTitle}>
                  {INVITE_COPY.qrTitle.toUpperCase()}
                </Text>
                <Text
                  style={styles.backCode}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {code}
                </Text>
                <Text style={styles.backLink} numberOfLines={2}>
                  {link?.replace(/^https:\/\//, "")}
                </Text>
                <View style={styles.backBrand}>
                  <Brand />
                </View>
              </View>
            </View>
          </ViewShot>
        </Animated.View>
      </Pressable>

      {/* The copy and share buttons sit on layers above the flip button, not
          inside it (a button can't hold another button on web). Each layer
          turns with its face and only takes touches while that face shows;
          touches anywhere else fall through to the flip button. */}
      <Animated.View
        style={[styles.buttonLayer, frontStyle]}
        pointerEvents={showingQr ? "none" : "box-none"}
      >
        {code && onCopyCode && codeBox ? (
          <Pressable
            onPress={onCopyCode}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`${INVITE_COPY.copy} ${INVITE_COPY.codeLabel.toLowerCase()}`}
            style={({ pressed }) => [
              {
                position: "absolute",
                left: TOP_ROW_INSET + codeBox.x,
                top: TOP_ROW_INSET + codeBox.y,
                width: codeBox.width,
                height: codeBox.height,
              },
              pressed && styles.codeCopyPressed,
            ]}
          />
        ) : null}
      </Animated.View>
      <Animated.View
        style={[styles.buttonLayer, backStyle]}
        pointerEvents={showingQr ? "box-none" : "none"}
      >
        {/* Not in the QR ViewShot, so it isn't in the shared picture. */}
        {onShareQr ? (
          <Pressable
            onPress={onShareQr}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={INVITE_COPY.shareQr}
            style={({ pressed }) => [
              styles.shareIcon,
              pressed && styles.codeCopyPressed,
            ]}
          >
            <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
});

function Brand() {
  return (
    <View style={styles.brandGroup}>
      <View style={styles.brandIcon}>
        <MaterialCommunityIcons name="sword-cross" size={13} color="#FFFFFF" />
      </View>
      <Text style={styles.brandText}>HunterX.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: CARD_HEIGHT,
  },
  buttonLayer: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: "hidden",
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: "#0A0E17",
    shadowColor: "#FE5B01",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
    elevation: 10,
  },
  pressable: {
    flex: 1,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#0A0E17",
    backfaceVisibility: "hidden",
  },
  backFace: {
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#FE5B01",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 16,
    justifyContent: "center",
  },
  scanLineGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 16,
  },
  scanLineCore: {
    height: 1.5,
    backgroundColor: "rgba(254, 91, 1, 0.5)",
    width: "100%",
  },
  topRow: {
    position: "absolute",
    top: TOP_ROW_INSET,
    left: TOP_ROW_INSET,
    right: TOP_ROW_INSET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rarityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderWidth: 1,
    borderColor: "#FE5B01",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rarityText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    color: "#FE5B01",
    letterSpacing: 0.5,
  },
  starCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FE5B01",
    alignItems: "center",
    justifyContent: "center",
  },
  shareIcon: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FE5B01",
    alignItems: "center",
    justifyContent: "center",
  },
  codeCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  codeCopyPressed: {
    opacity: 0.6,
  },
  codeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    color: "#38BDF8",
    letterSpacing: 0.5,
  },
  centerText: {
    position: "absolute",
    bottom: 44,
    left: 12,
  },
  mainTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 32,
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.95)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 9.5,
    color: "#FE5B01",
    letterSpacing: 1.2,
    marginTop: 1,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footerRow: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#22D3EE",
  },
  brandText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  issuerBadge: {
    flexShrink: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.75,
    borderColor: "rgba(34, 211, 238, 0.25)",
  },
  issuerText: {
    fontFamily: fontFamilies.bold,
    fontSize: 7.5,
    color: "#38BDF8",
    letterSpacing: 0.5,
  },
  flipIcon: {
    position: "absolute",
    top: 44,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  frontShot: {
    flex: 1,
    backgroundColor: "#0A0E17",
  },
  backShot: {
    flex: 1,
    backgroundColor: "#000000",
  },
  backContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  qrFrame: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  backText: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "center",
    gap: 6,
  },
  backTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: "#FE5B01",
    letterSpacing: 1.2,
  },
  backCode: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  backLink: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    lineHeight: 14,
    color: "#A1A1AA",
  },
  backBrand: {
    marginTop: 8,
  },
});
