import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";

import { CountBadge } from "@/components/common/CountBadge";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/typography";
import { INVITE_COPY } from "./inviteCopy";

const LAST_SHOWN_KEY = "hunterx.inviteNudge.lastShownAt";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** True at most once every 7 days; records the showing as it says yes. */
async function claimWeeklySlot(): Promise<boolean> {
  try {
    const last = Number(await AsyncStorage.getItem(LAST_SHOWN_KEY));
    if (last && Date.now() - last < WEEK_MS) return false;
    await AsyncStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/**
 * "Invite a friend to hunt with you" — shown at most once a week, dismissible.
 * `persistent` (Leaderboard > Friends): always shown, no ✕.
 * `badgeCount`: friend requests waiting, as a red count on Invite (they're
 * answered on the Invite Friends screen it opens).
 */
export function InviteNudgeCard({
  onInvite,
  persistent = false,
  badgeCount = 0,
}: {
  onInvite: () => void;
  persistent?: boolean;
  badgeCount?: number;
}) {
  const [visible, setVisible] = useState(persistent);
  // Fade out only when the user taps ✕. Being unmounted by the parent (e.g.
  // Leaderboard switching Global ⇄ Friends, which swaps this card for the
  // persistent one) must not fade, or the two cards overlap mid-switch.
  const [isDismissing, setIsDismissing] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (persistent) return;
    let cancelled = false;
    claimWeeklySlot().then((show) => {
      if (!cancelled && show) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [persistent]);

  if (!visible) return null;

  const dismiss = () => {
    setIsDismissing(true);
    // Unmount on the next frame, once `exiting` below is set.
    requestAnimationFrame(() => setVisible(false));
  };

  return (
    <Animated.View
      // Fade in only when the weekly nudge appears; the persistent card is
      // simply there.
      entering={reduceMotion || persistent ? undefined : FadeIn.duration(300)}
      exiting={reduceMotion || !isDismissing ? undefined : FadeOut.duration(200)}
      style={[styles.card, persistent && styles.cardPersistent]}
    >
      <View style={styles.iconBox}>
        <Ionicons name="people" size={18} color={colors.accentOrange} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {INVITE_COPY.nudgeTitle}
      </Text>
      <Pressable
        onPress={onInvite}
        accessibilityRole="button"
        accessibilityLabel={
          badgeCount > 0
            ? `${INVITE_COPY.nudgeTitle}. ${badgeCount} friend request${badgeCount === 1 ? "" : "s"} waiting.`
            : INVITE_COPY.nudgeTitle
        }
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.actionText}>{INVITE_COPY.nudgeAction}</Text>
        <CountBadge count={badgeCount} ringColor={colors.surface} />
      </Pressable>
      {persistent ? null : (
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={INVITE_COPY.nudgeDismiss}
          style={styles.dismiss}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 4,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(254, 91, 1, 0.35)",
  },
  cardPersistent: {
    paddingRight: 10,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(254, 91, 1, 0.12)",
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  action: {
    backgroundColor: colors.accentOrange,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
  actionText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.background,
  },
  dismiss: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
