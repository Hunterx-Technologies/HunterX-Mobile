import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "@/components/common/Screen";
import {
  GuestPassCard,
  type GuestPassCardHandle,
} from "@/components/features/invite/GuestPassCard";
import {
  INVITE_COPY,
  inviteLink,
  shareMessage,
} from "@/components/features/invite/inviteCopy";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchInvitedFriends,
  isNetworkError,
  type InvitedFriendsSource,
} from "@/services/api/referral.service";
import {
  readInviteCache,
  writeInviteCache,
} from "@/services/referral/inviteCache";
import {
  PREVIEW_CODE,
  PREVIEW_OFFLINE_CACHE,
  isInvitePreview,
  previewSource,
} from "@/services/referral/inviteFixtures";
import RNShare from "@/services/share/RNShare";
import { showGlobalToast } from "@/store/useToastStore";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/typography";

export default function InviteFriendsScreen() {
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ preview?: string }>();
  // Developer menu previews (dev builds only) run on fixtures, not the API.
  const preview =
    __DEV__ && isInvitePreview(params.preview) ? params.preview : null;

  const userId = user?.id ? String(user.id) : null;
  const profileCode = preview ? PREVIEW_CODE : (user?.referral_code ?? null);
  const fallbackCount = user?.accepted_invites_count ?? 0;

  const [cachedCode, setCachedCode] = useState<string | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [sharing, setSharing] = useState<"pass" | "qr" | null>(null);
  const cardRef = useRef<GuestPassCardHandle>(null);

  const code = profileCode ?? cachedCode;

  const source: InvitedFriendsSource = useMemo(
    () =>
      preview ? previewSource(preview) : fetchInvitedFriends(fallbackCount),
    [preview, fallbackCount],
  );

  const load = useCallback(async () => {
    try {
      const fresh = await source();
      setJoinedCount(fresh.count);
      setIsOffline(false);
      if (userId && !preview) writeInviteCache(userId, { friends: fresh });
    } catch (err) {
      setIsOffline(isNetworkError(err));
      if (preview === "offline")
        setJoinedCount((current) => current ?? PREVIEW_OFFLINE_CACHE.count);
    }
  }, [source, userId, preview]);

  // Cached code + count first (instant, and all there is offline), then the network.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (userId && !preview) {
        const cached = await readInviteCache(userId);
        if (cancelled) return;
        if (cached?.code) setCachedCode(cached.code);
        if (cached?.friends)
          setJoinedCount((current) => current ?? cached.friends!.count);
      }
      if (!cancelled) load();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, preview, load]);

  useEffect(() => {
    if (userId && profileCode && !preview)
      writeInviteCache(userId, { code: profileCode });
  }, [userId, profileCode, preview]);

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [isCopied]);

  if (isBootstrapping) return null;
  if (!isAuthenticated && !preview) return <Redirect href="/(auth)/login" />;

  const link = code ? inviteLink(code) : null;

  const handleCopyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    showGlobalToast(INVITE_COPY.codeCopied, "success", 2000);
  };

  const handleCopyLink = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setIsCopied(true);
    showGlobalToast(INVITE_COPY.linkCopied, "success", 2000);
  };

  // Shares a picture of one side of the card, with the invite message as
  // text for apps that drop the image. Falls back to text only (web, or the
  // capture failed).
  const shareCard = async (side: "pass" | "qr") => {
    if (!code || sharing) return;
    setSharing(side);
    try {
      const uri = await cardRef.current?.capture(side);
      if (!uri) throw new Error("capture unavailable");
      await RNShare.open({
        title: INVITE_COPY.shareQrTitle,
        message: shareMessage(code),
        url: uri,
        type: "image/png",
        failOnCancel: false,
      });
    } catch {
      try {
        await Share.share({ message: shareMessage(code) });
      } catch {
        showGlobalToast(INVITE_COPY.shareFailed, "error");
      }
    } finally {
      setSharing(null);
    }
  };

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/(tabs)/profile");

  return (
    <Screen style={styles.screen} edges={["top"]}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={goBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{INVITE_COPY.screenTitle}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isOffline ? (
          <View style={styles.offlineBanner} accessibilityLiveRegion="polite">
            <Ionicons
              name="cloud-offline-outline"
              size={16}
              color={colors.accentOrange}
            />
            <Text style={styles.offlineText}>{INVITE_COPY.offline}</Text>
          </View>
        ) : null}

        <View style={styles.headlineGroup}>
          <Text style={styles.subheadlineText}>{INVITE_COPY.subtext}</Text>
        </View>

        <View style={styles.cardBlock}>
          <GuestPassCard
            ref={cardRef}
            code={code}
            issuerName={preview ? "Shadow" : user?.displayName}
            onCopyCode={handleCopyCode}
            onShareQr={() => shareCard("qr")}
          />
          <Text style={styles.flipHint}>{INVITE_COPY.flipHint}</Text>
        </View>

        <View style={styles.linkSection}>
          <Text style={styles.linkHeader}>{INVITE_COPY.linkLabel}</Text>

          <View style={styles.dottedLinkBox}>
            <Text style={styles.linkText} numberOfLines={1} selectable>
              {link ?? "—"}
            </Text>
            <Pressable
              onPress={handleCopyLink}
              disabled={!link}
              accessibilityRole="button"
              accessibilityLabel={`${INVITE_COPY.copy} ${INVITE_COPY.linkLabel.toLowerCase()}`}
              style={({ pressed }) => [
                styles.copyPillBtn,
                !link && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.copyPillText}>
                {isCopied ? INVITE_COPY.copiedShort : INVITE_COPY.copy}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.linkSubtext}>{INVITE_COPY.linkNote}</Text>
          {joinedCount ? (
            <Text style={styles.linkSubtext}>
              {INVITE_COPY.joinedCount(joinedCount)}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomBtnWrapper, { bottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => shareCard("pass")}
          disabled={!code || sharing !== null}
          accessibilityRole="button"
          accessibilityLabel={INVITE_COPY.inviteFriends}
          style={({ pressed }) => [
            styles.invitePillBtn,
            (!code || sharing !== null) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="paper-plane" size={18} color="#000000" />
          <Text style={styles.inviteBtnText}>{INVITE_COPY.inviteFriends}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#09090B",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#242428",
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: "#FFFFFF",
    textAlign: "center",
  },
  scrollContent: {
    padding: 20,
    alignItems: "center",
    gap: 20,
  },
  offlineBanner: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(254, 91, 1, 0.35)",
    backgroundColor: "rgba(254, 91, 1, 0.08)",
  },
  offlineText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  headlineGroup: {
    alignItems: "center",
    gap: 6,
  },
  subheadlineText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
  },
  cardBlock: {
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  flipHint: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: "#71717A",
  },
  linkSection: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  linkHeader: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  dottedLinkBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    backgroundColor: "#16161C",
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "#3F3F46",
    borderStyle: "dashed",
    paddingVertical: 8,
    paddingLeft: 18,
    paddingRight: 8,
  },
  linkText: {
    flex: 1,
    marginRight: 10,
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: "#A1A1AA",
  },
  copyPillBtn: {
    backgroundColor: "#FE5B01",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  copyPillText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: "#0D0F12",
  },
  linkSubtext: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: "#71717A",
    textAlign: "center",
  },
  bottomBtnWrapper: {
    position: "absolute",
    left: 20,
    right: 20,
  },
  invitePillBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  inviteBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: "#000000",
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
});
