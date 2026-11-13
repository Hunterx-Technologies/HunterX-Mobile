import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

import { fetchTasksToday, completeTask, reopenTask } from '@/services/api/tasks.service';
import { invalidateLeaderboardCache } from '@/hooks/useLeaderboard';
import { mapTaskToQuest, type QuestItem } from '@/utils/quests';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { usePushPermissionPrompt } from '@/hooks/usePushPermissionPrompt';
import { PushPermissionModal } from '@/components/features/notifications/PushPermissionModal';
import { getCurrentUser, msSinceCurrentUserFetched, userFromApi } from '@/services/api/auth.service';
import { DEFAULT_BLURHASH } from '@/services/media/cloudinary';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Screen } from '@/components/common/Screen';
import { ExactMedalIcon } from '@/components/common/ExactMedalIcon';
import { MissionResultsScreen } from '@/components/features/missions/MissionResultsScreen';
import { QuestListCard } from '@/components/features/missions/QuestListCard';
import { PaidTaskPurchaseModal } from '@/components/features/missions/PaidTaskPurchaseModal';
import { LootDropModal } from '@/components/features/loot/LootDropModal';
import { QuestActionModal } from '@/components/features/missions/QuestActionModal';
import { ProofSubmitModal } from '@/components/features/missions/ProofSubmitModal';
import { RoutineTasksModal } from '@/components/features/routine/RoutineTasksModal';
import { showGlobalToast } from '@/store/useToastStore';
import { HomeOverlays } from '@/components/features/missions/HomeOverlays';
import { showHomeErrorToast, useHomeOverlayStore } from '@/store/useHomeOverlayStore';
import { WeeklyTracker } from '@/components/features/streaks/WeeklyTracker';
import * as Haptics from 'expo-haptics';
import { playTaskDoneSound } from '@/services/audio/taskDoneSound';
import { useAuth } from '@/hooks/useAuth';
import { useLootDrop } from '@/hooks/useLootDrop';
import { fontFamilies } from '@/theme/typography';
import { getAvatarSource } from '@/components/profile/AvatarSelectionModal';
import { useAvatarsReady } from '@/services/api/avatar.service';
import { useStreakBadgeStore } from '@/store/useStreakBadgeStore';
import { setCelebrationHold, showReward, useCelebrationStore } from '@/store/useCelebrationStore';
import { syncStreakBadges, useStreakBadgeSync } from '@/hooks/useStreakBadgeSync';
import { DeletionPendingNotice } from '@/components/common/DeletionPendingNotice';
import { API_ERROR, PENDING_DELETION_MESSAGE, getApiErrorCode } from '@/services/api/errors';
import { showLevelUpFromApi } from '@/store/useLevelUpStore';
import { useStreakBreakStore } from '@/store/useStreakBreakStore';
import { StreakPillLanding } from '@/components/features/streaks/StreakPillLanding';
import { useScrollToTopOnFocus } from '@/hooks/useScrollToTopOnFocus';
import { readTasksTodayCache, writeTasksTodayCache } from '@/services/cache/tasksTodayCache';
import { devWarn } from '@/services/health/devLog';
import type { TasksTodayData } from '@/types/task';

function getTodayDateStr(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Returning to Home within this window keeps what's on screen instead of refetching.
const HOME_REFRESH_MIN_MS = 20_000;
// A profile fetched this recently isn't fetched again on Home's focus.
const PROFILE_FRESH_MS = 5_000;

function mapTasksToday(data: TasksTodayData): QuestItem[] {
  return [
    ...(data.daily || []).map((item) => mapTaskToQuest(item, 'daily')),
    ...(data.weekly || []).map((item) => mapTaskToQuest(item, 'weekly')),
    ...(data.monthly || []).map((item) => mapTaskToQuest(item, 'monthly')),
    ...(data.locked || []).map((item) => mapTaskToQuest(item, 'locked')),
  ];
}

/** "Day Complete" auto-opens once per (local) day, per account — not per device. */
const dayCompleteStorageKey = (userId: string | number | undefined) =>
  `hasShownDayComplete_${userId ?? 'anon'}_${getTodayDateStr()}`;

// Time for a closing modal to finish animating before the next one opens
// (iOS drops a modal presented while another is still dismissing).
const MODAL_GAP_MS = 450;

export default function MissionsHomeScreen() {
  const { user } = useAuth();
  // Shows the streak break card when a life was used since the last visit.
  const { lastDrop } = useLootDrop();
  const params = useLocalSearchParams<{ fromAscension?: string }>();
  const isFromAscension = params.fromAscension === 'true';

  const scrollRef = useRef<ScrollView>(null);

  useScrollToTopOnFocus(scrollRef);
  useScrollToTop(scrollRef);

  // Lets the streak badge popup scroll home to the Badges section.
  const scrollYRef = useRef(0);
  useEffect(
    () =>
      useStreakBadgeStore.getState().setHomeScroller((dy) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollYRef.current + dy), animated: true });
      }),
    []
  );

  // Lets the streak break card's flame fly into the header pill.
  const streakFlameRef = useRef<View>(null);
  useEffect(
    () =>
      useStreakBreakStore.getState().setPillLocator(async () => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        if (scrollYRef.current > 0) await new Promise((resolve) => setTimeout(resolve, 380));
        return new Promise((resolve) => {
          const view = streakFlameRef.current;
          if (!view) return resolve(null);
          view.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
        });
      }),
    []
  );



  // Re-renders once the avatar catalog loads so the header avatar reflects
  // the user's actual avatar_id instead of the generic fallback image.
  useAvatarsReady();

  const [dropVisible, setDropVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'todo' | 'done' | 'skipped'>('todo');

  // Cinematic black overlay fade-out matching the intro audio after onboarding
  const [showBlackIntroOverlay, setShowBlackIntroOverlay] = useState(isFromAscension);
  const blackFadeAnim = useRef(new Animated.Value(isFromAscension ? 1 : 0)).current;

  useEffect(() => {
    if (isFromAscension) {
      Animated.timing(blackFadeAnim, {
        toValue: 0,
        duration: 2400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setShowBlackIntroOverlay(false);
      });
    }
  }, [isFromAscension, blackFadeAnim]);

  const [quests, setQuests] = useState<QuestItem[]>([]);
  // Mirrors `quests` synchronously so the handlers below can read the
  // latest list without needing `quests` in their own dependency array —
  // that's what lets them stay referentially stable across renders, which
  // in turn is what lets <QuestListCard> below actually skip re-rendering
  // via React.memo instead of every quest row re-rendering on every
  // unrelated state change in this screen.
  const questsRef = useRef(quests);
  questsRef.current = quests;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedQuest, setSelectedQuest] = useState<QuestItem | null>(null);
  /** The proof quest whose upload sheet is open. */
  const [proofQuest, setProofQuest] = useState<QuestItem | null>(null);
  const [selectedBuyQuest, setSelectedBuyQuest] = useState<QuestItem | null>(null);
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [dayCompleteModalVisible, setDayCompleteModalVisible] = useState(false);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  // Toasts and the first-quest sheet live in useHomeOverlayStore, drawn by
  // <HomeOverlays>: changing them doesn't re-render this screen. Home only
  // needs to know whether the sheet is open (celebrations wait for it).
  const taskBottomSheetVisible = useHomeOverlayStore((s) => s.sheet.visible);

  // refreshUser defaults to false: useAuthStore.restoreSession() already
  // fetches the user once at app boot, so re-fetching it here too on every
  // plain mount would just duplicate that request. Callers that need fresh
  // XP/streak/level after something actually changed it server-side (a
  // screen focus, or after completeTask/reopenTask) pass true.
  const userIdKey = user?.id != null ? String(user.id) : null;
  const userIdKeyRef = useRef(userIdKey);
  userIdKeyRef.current = userIdKey;
  /** When today's tasks last came from the server (not the saved copy), and for whom. */
  const lastLoadRef = useRef<{ at: number; day: string; userId: string | null } | null>(null);
  /** True once this screen has the server's answer, not just the saved copy. */
  const [tasksFresh, setTasksFresh] = useState(false);
  const tasksFreshRef = useRef(false);

  const loadTasks = useCallback(async (options?: { refreshUser?: boolean }) => {
    try {
      setError(null);
      const [tasksData, refreshedUser] = await Promise.all([
        fetchTasksToday(),
        options?.refreshUser ? getCurrentUser() : Promise.resolve(null),
      ]);
      const mapped = mapTasksToday(tasksData);
      setQuests(mapped);
      tasksFreshRef.current = true;
      setTasksFresh(true);
      lastLoadRef.current = { at: Date.now(), day: getTodayDateStr(), userId: userIdKeyRef.current };
      if (userIdKeyRef.current) writeTasksTodayCache(userIdKeyRef.current, tasksData);
      if (refreshedUser) {
        useAuthStore.getState().setUser(refreshedUser);
      }

      // Warm the memory+disk cache for every quest image right away rather
      // than waiting for each card to mount. Fire-and-forget: a failed
      // prefetch just falls back to the normal on-demand load in the
      // <ExpoImage> itself, so this never blocks the task list from showing.
      mapped.forEach((quest) => {
        if (quest.image?.uri) {
          ExpoImage.prefetch(quest.image.uri, 'memory-disk').catch(() => { });
        }
      });
    } catch (err: any) {
      devWarn('[LoadTasks Error]', err);
      // With the saved copy on screen (e.g. offline), keep showing it rather
      // than replacing today's quests with an error.
      if (!tasksFreshRef.current && questsRef.current.length > 0) return;
      setError(err?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  const unreadNotifications = useNotificationStore((s) => s.unreadCount);
  const refreshUnreadNotifications = useNotificationStore((s) => s.refreshUnreadCount);

  // Show the saved copy of today's quests straight away (cold start,
  // offline); the server's answer replaces it as soon as it arrives.
  useEffect(() => {
    if (!userIdKey) return;
    let cancelled = false;
    readTasksTodayCache(userIdKey).then((cached) => {
      if (cancelled || !cached || tasksFreshRef.current) return;
      setQuests(mapTasksToday(cached));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userIdKey]);

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      // Coming straight back (e.g. a quick look at another tab) keeps what's
      // on screen; every change made on Home reloads it itself anyway.
      const last = lastLoadRef.current;
      const isFresh =
        !!last &&
        last.userId === userIdKeyRef.current &&
        last.day === getTodayDateStr() &&
        Date.now() - last.at < HOME_REFRESH_MIN_MS;
      // The profile is refreshed too, unless it arrived moments ago (e.g. the
      // session restore at app start).
      if (!isFresh) loadTasks({ refreshUser: msSinceCurrentUserFetched() > PROFILE_FRESH_MS });
      refreshUnreadNotifications();
    }, [loadTasks, refreshUnreadNotifications])
  );

  const prevGenderRef = useRef(user?.gender);
  useEffect(() => {
    if (prevGenderRef.current !== undefined && prevGenderRef.current !== user?.gender) {
      loadTasks();
    }
    prevGenderRef.current = user?.gender;
  }, [loadTasks, user?.gender]);

  // Earned streak badges (crack-the-seal popup) show here on home.
  useStreakBadgeSync(!!user?.id);

  // The "allow notifications" prompt, offered once the hunter has earned XP.
  const pushPrompt = usePushPermissionPrompt();

  // Celebrations (level-up, badge, reward…) wait while one of home's own
  // popups is up, instead of opening on top of it. Day Complete waits its
  // turn in the other direction: it opens once nothing is celebrating.
  const celebrating = useCelebrationStore((s) => s.current !== null || s.queue.length > 0);
  // Counts as idle a moment after the last celebration closes: iOS can't
  // present a modal while another is still dismissing — it silently doesn't
  // appear — so Day Complete waits for the closing animation to finish.
  const [celebrationsIdle, setCelebrationsIdle] = useState(!celebrating);
  useEffect(() => {
    if (celebrating) {
      setCelebrationsIdle(false);
      return;
    }
    const timer = setTimeout(() => setCelebrationsIdle(true), MODAL_GAP_MS);
    return () => clearTimeout(timer);
  }, [celebrating]);
  const showDayComplete = dayCompleteModalVisible && celebrationsIdle;
  // Bumped on every open so the screen is mounted fresh — if a previous
  // open never made it onto the screen, Celebrate still opens it.
  const [dayCompleteKey, setDayCompleteKey] = useState(0);
  const openDayComplete = useCallback(() => {
    setDayCompleteKey((k) => k + 1);
    setDayCompleteModalVisible(true);
  }, []);
  const holdCelebrations = taskBottomSheetVisible || showDayComplete || showBlackIntroOverlay || pushPrompt.visible;
  useEffect(() => {
    setCelebrationHold('home', holdCelebrations);
  }, [holdCelebrations]);
  useEffect(() => () => setCelebrationHold('home', false), []);

  // Offer push notifications once the hunter has earned XP — never over
  // another Home modal, the post-Ascension intro fade, or a celebration
  // (the first XP is exactly when level-up / reward screens play).
  const maybeOfferPush = pushPrompt.maybeOffer;
  const isHomeModalOpen =
    dropVisible || actionModalVisible || dayCompleteModalVisible || taskBottomSheetVisible || showBlackIntroOverlay || !!proofQuest || celebrating;
  useEffect(() => {
    if (isHomeModalOpen) return;
    const timer = setTimeout(() => maybeOfferPush((user?.xp ?? 0) > 0), 1500);
    return () => clearTimeout(timer);
  }, [isHomeModalOpen, user?.xp, maybeOfferPush]);

  // Neutral values until the profile has loaded — never someone else's stats.
  const displayName = user?.displayName ? user.displayName.toUpperCase() : 'HUNTER';
  const displayXP = (user?.xp ?? 0).toLocaleString();
  const displayLevel = user?.level ?? 1;
  const displayStreak = user?.currentStreak ?? user?.user_progression?.daily_streak ?? 0;
  const completedDays =
    user?.completedDaysCount ??
    (user?.week_status?.days
      ? user.week_status.days.filter((d) => d.status === 'DONE' || d.status === 'COMPLETED').length
      : user?.weeklyStreak ?? user?.user_progression?.weekly_streak ?? Math.min(displayStreak, 7));

  const dailyQuests = quests.filter((q) => q.type === 'daily');
  const lockedQuests = quests.filter((q) => q.status === 'locked' || q.type === 'locked');

  const todoQuests = quests.filter((q) => q.status === 'todo');
  const doneQuests = quests.filter((q) => q.status === 'done' || q.status === 'partial');
  const skippedQuests = quests.filter((q) => q.status === 'skipped');

  const dailyTodoQuests = todoQuests.filter((q) => q.type === 'daily');
  const weeklyTodoQuests = todoQuests.filter((q) => q.type === 'weekly');
  const monthlyTodoQuests = todoQuests.filter((q) => q.type === 'monthly');

  const dailyDoneQuests = doneQuests.filter((q) => q.type === 'daily');
  const weeklyDoneQuests = doneQuests.filter((q) => q.type === 'weekly');
  const monthlyDoneQuests = doneQuests.filter((q) => q.type === 'monthly');

  const dailySkippedQuests = skippedQuests.filter((q) => q.type === 'daily');
  const weeklySkippedQuests = skippedQuests.filter((q) => q.type === 'weekly');
  const monthlySkippedQuests = skippedQuests.filter((q) => q.type === 'monthly');

  // The day counts as cleared when no daily task is left to do and at least
  // one was completed (the rest may be skipped). All skipped isn't a clear.
  const dayCleared = dailyQuests.length > 0 && dailyTodoQuests.length === 0 && dailyDoneQuests.length > 0;

  // Automatically pop up the MissionResultsScreen celebration ONCE per day when the day is cleared.
  // It waits until home's other popups (the quest's action sheet, "Quest
  // Cleared", proof upload…) have closed, so it never opens on top of one
  // still animating away — on iOS that open is silently dropped.
  const [dayCompletePending, setDayCompletePending] = useState(false);
  useEffect(() => {
    if (loading || !tasksFresh) return;
    if (!dayCleared) {
      // Not (or no longer) cleared — e.g. a skipped task was reopened. Forget
      // that it was shown, so clearing the day again earns the screen again.
      setDayCompletePending(false);
      AsyncStorage.removeItem(dayCompleteStorageKey(user?.id)).catch(() => { });
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(dayCompleteStorageKey(user?.id))
      .then((hasShown) => {
        if (!cancelled && !hasShown) setDayCompletePending(true);
      })
      .catch((err) => {
        console.warn('[DayCompleteModal] Storage check error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, tasksFresh, dayCleared, user?.id]);

  const otherHomeModalOpen =
    dropVisible || actionModalVisible || taskBottomSheetVisible || showBlackIntroOverlay || !!proofQuest;
  useEffect(() => {
    if (!dayCompletePending || otherHomeModalOpen) return;
    const timer = setTimeout(() => {
      setDayCompletePending(false);
      AsyncStorage.setItem(dayCompleteStorageKey(user?.id), 'true').catch(() => { });
      openDayComplete();
    }, MODAL_GAP_MS);
    return () => clearTimeout(timer);
  }, [dayCompletePending, otherHomeModalOpen, openDayComplete, user?.id]);

  const prevTodoCountRef = useRef<number | null>(null);

  // Automatically manage activeTab based on tasks
  useEffect(() => {
    if (!loading) {
      const prevCount = prevTodoCountRef.current;
      const currentCount = todoQuests.length;

      // On initial load, default to 'todo' tab so user can see To-Do tab and Daily Quests Cleared banner
      if (prevCount === null) {
        setActiveTab('todo');
      }
      // Action occurred: task reopened/added back to todo
      else if (currentCount > 0 && prevCount === 0) {
        setActiveTab('todo');
      }

      prevTodoCountRef.current = currentCount;
    }
  }, [loading, todoQuests.length, quests.length]);

  // While the account waits to be deleted, quest actions are off (the
  // server refuses them too, with ACCOUNT_PENDING_DELETION).
  const deletionPending = !!user?.deleteAt;
  const deletionPendingRef = useRef(deletionPending);
  deletionPendingRef.current = deletionPending;
  const showDeletionPendingNotice = useCallback(() => {
    showHomeErrorToast('Account Deletion Pending', PENDING_DELETION_MESSAGE);
  }, []);

  const handleCompleteTask = useCallback(async (
    questId: string,
    actionStatus: 'COMPLETED' | 'PARTIAL' | 'SKIPPED' | 'PENDING'
  ) => {
    if (deletionPendingRef.current) {
      showDeletionPendingNotice();
      return;
    }
    const previousQuests = questsRef.current;
    const mappedStatus = actionStatus === 'COMPLETED' ? 'done' : actionStatus === 'PARTIAL' ? 'partial' : actionStatus === 'SKIPPED' ? 'skipped' : 'todo';

    const targetQuest = previousQuests.find(q => q.id === questId);
    if (!targetQuest) return;

    let optimisticEarnedXp = 0;
    if (actionStatus === 'COMPLETED') {
      optimisticEarnedXp = targetQuest.xpReward;
    } else if (actionStatus === 'PARTIAL') {
      optimisticEarnedXp = targetQuest.xpPartial ?? Math.round(targetQuest.xpReward / 2);
    }

    setQuests((prev) =>
      prev.map((q) =>
        q.id === questId
          ? {
            ...q,
            status: mappedStatus,
            earnedXp: actionStatus === 'PENDING' ? undefined : optimisticEarnedXp,
          }
          : q
      )
    );

    if (actionStatus === 'COMPLETED' || actionStatus === 'PARTIAL') {
      const isPartial = actionStatus === 'PARTIAL';

      // Check if this is the FIRST task completed of the day
      const isFirstTaskOfToday = previousQuests.filter(
        (q) => q.status === 'done' || q.status === 'partial'
      ).length === 0;

      if (isFirstTaskOfToday) {
        // Show celebration bottom sheet ONLY on the first task of the day
        useHomeOverlayStore.getState().showTaskSheet({
          title: `Quest Cleared: ${targetQuest.title}`,
          subtitle: 'One day down. The flame grows stronger with each rise.',
          xp: optimisticEarnedXp,
        });
      } else {
        // Subsequent tasks completed on the same day show top toast instead
        useHomeOverlayStore.getState().showCompletedToast({
          title: isPartial ? 'Partial Progress!' : 'Task Completed!',
          subtitle: isPartial ? 'Progress logged · Half XP earned!' : 'Great job, hunter!',
          xp: optimisticEarnedXp,
        });
      }

      playTaskDoneSound(isPartial ? 'partial' : 'completed');
    } else {
      useHomeOverlayStore.getState().hideCompletedToast();
    }

    try {
      const data = await completeTask(questId, actionStatus);

      // Celebrations play one after another (streak badge first, then any
      // scratch card). Cards come without their prize; it's revealed when
      // scratched in the wallet.
      // A new streak badge is fetched from the unseen list (so it's shown,
      // and marked seen, the same way however it was earned).
      if (data.streak_milestone) syncStreakBadges();
      showLevelUpFromApi(data.level_up);
      (data.rewards_earned ?? []).forEach(showReward);

      // XP changed — the backend has already moved this hunter on the
      // leaderboard (a first completed task is what puts a new hunter on it
      // at all). Marks it stale; it refetches when the Leaderboard opens,
      // not now, in the middle of the celebration.
      invalidateLeaderboardCache();

      const serverStatus = data.status === 'COMPLETED' ? 'done' : data.status === 'PARTIAL' ? 'partial' : data.status === 'SKIPPED' ? 'skipped' : 'todo';

      setQuests((prev) =>
        prev.map((q) =>
          q.id === questId
            ? {
              ...q,
              status: serverStatus,
              earnedXp: data.status === 'PENDING' ? undefined : data.xp_earned,
            }
            : q
        )
      );

      // New XP / level / streak: from the response (no /auth/me call), or
      // from /auth/me on a backend that doesn't send it yet.
      try {
        const refreshedUser = data.user ? userFromApi(data.user) : await getCurrentUser();
        useAuthStore.getState().setUser(refreshedUser);
      } catch (userErr) {
        devWarn('[RefreshUser Error]', userErr);
      }
    } catch (err: any) {
      devWarn('[CompleteTask Error]', err);
      setQuests(previousQuests);
      useHomeOverlayStore.getState().hideCompletedToast();

      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || 'Failed to update task';

      if (status === 401) {
        await useAuthStore.getState().logout();
        return;
      }

      if (getApiErrorCode(err) === API_ERROR.ACCOUNT_PENDING_DELETION) {
        showDeletionPendingNotice();
        getCurrentUser().then(useAuthStore.getState().setUser).catch(() => {});
        return;
      }

      if (status === 403) {
        showHomeErrorToast('Task Stale', 'This task is not assigned to you for the current period. Refreshing...');
        await loadTasks();
        return;
      }

      showHomeErrorToast('Action Failed', message);
    }
  }, [loadTasks, showDeletionPendingNotice]);

  // Takes a questId (not a full QuestItem) and stays referentially stable
  // ([handleCompleteTask] never changes identity — see above) specifically
  // so <QuestListCard>'s React.memo isn't defeated by a new function prop
  // on every render.
  const handleOpenQuestActions = useCallback((questId: string) => {
    if (deletionPendingRef.current) {
      showDeletionPendingNotice();
      return;
    }
    const quest = questsRef.current.find((q) => q.id === questId);
    if (!quest) return;
    // Proof quests are completed by uploading photos for review.
    if ((quest.proofCount ?? 0) > 0) {
      setProofQuest(quest);
      return;
    }
    if (quest.allows_partial) {
      setSelectedQuest(quest);
      setActionModalVisible(true);
    } else {
      handleCompleteTask(quest.id, 'COMPLETED');
    }
  }, [handleCompleteTask, showDeletionPendingNotice]);

  const handleOpenBuyModal = useCallback((quest: QuestItem) => {
    setSelectedBuyQuest(quest);
    setBuyModalVisible(true);
  }, []);

  const handleConfirmPurchase = useCallback((quest: QuestItem) => {
    setBuyModalVisible(false);
    showHomeErrorToast('Payment Coming Soon', `Checkout for "${quest.title}" (₹${quest.price ?? 499}) will be available in the upcoming release.`);
  }, []);

  const handleDirectSkip = useCallback((questId: string) => {
    // Paid quests can't be skipped.
    if (questsRef.current.find((q) => q.id === questId)?.is_paid) return;
    handleCompleteTask(questId, 'SKIPPED');
  }, [handleCompleteTask]);

  const handleResetQuest = useCallback(async (questId: string) => {
    if (deletionPendingRef.current) {
      showDeletionPendingNotice();
      return;
    }
    const previousQuests = questsRef.current;
    setQuests((prev) =>
      prev.map((q) =>
        q.id === questId ? { ...q, status: 'todo', earnedXp: undefined } : q
      )
    );
    // A skipped quest that's reset is back in To-Do — take the user there
    // so they see it, instead of leaving them on the (now shorter) Skipped list.
    const wasSkipped = previousQuests.find((q) => q.id === questId)?.status === 'skipped';
    if (wasSkipped) setActiveTab('todo');
    try {
      const data = await reopenTask(questId);
      // XP taken back can change rank, or remove the hunter from the board.
      invalidateLeaderboardCache();
      try {
        const refreshedUser = data.user ? userFromApi(data.user) : await getCurrentUser();
        useAuthStore.getState().setUser(refreshedUser);
      } catch (userErr) {
        devWarn('[RefreshUser Error]', userErr);
      }
    } catch (err: any) {
      devWarn('[ReopenTask Error]', err);
      setQuests(previousQuests);
      // The quest is back in Skipped, so put the user back there too.
      if (wasSkipped) setActiveTab('skipped');

      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || 'Failed to reopen task';

      if (status === 401) {
        await useAuthStore.getState().logout();
        return;
      }

      showHomeErrorToast('Reopen Failed', message);
    }
  }, [showDeletionPendingNotice]);

  return (
    <Screen style={styles.screen}>
      <ScrollView
        bounces={false}
        overScrollMode="never"
        ref={scrollRef}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* TOP HEADER */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.userProfileGroup}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <View style={styles.avatarWrapper}>
              <ExpoImage
                source={getAvatarSource(user?.avatarUrl, (user as any)?.avatar_id)}
                style={styles.avatarImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                placeholder={{ blurhash: DEFAULT_BLURHASH }}
                transition={150}
              />
              <View style={styles.levelBadgeCircle}>
                <Text style={styles.levelBadgeText}>{displayLevel}</Text>
              </View>
            </View>

            <View style={styles.userTitles}>
              <Text style={styles.greetingText} numberOfLines={1} ellipsizeMode="tail">
                HEY, {displayName}!
              </Text>
              <Text style={styles.xpSubtext} numberOfLines={1}>{displayXP} XP · ARISE, HUNTER.</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <StreakPillLanding>
              <View style={styles.streakPill}>
                <View ref={streakFlameRef} collapsable={false}>
                  <Ionicons name="flame" size={20} color="#FF5500" />
                </View>
                <Text style={styles.streakText}>{displayStreak}</Text>
              </View>
            </StreakPillLanding>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
              {unreadNotifications > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        {/* Account deletion pending: links to Profile ("Keep my account") */}
        <DeletionPendingNotice />

        {/* ACTIVE CAMPAIGN SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleWide}>ACTIVE CAMPAIGN</Text>
        </View>

        {/* WEEKLY TRACKER (2ND ITEM) */}
        <WeeklyTracker
          weekStatus={user?.week_status}
          streakDays={displayStreak}
          completedDaysCount={completedDays}
          avatarUrl={user?.avatarUrl}
          avatarId={(user as any)?.avatar_id}
          userBadges={(user as any)?.badges}
        />

        {/* TODAY'S QUESTS HEADER + SHUFFLE (routine daily tasks only) */}
        <View style={styles.questsHeaderRow}>
          <Text style={styles.sectionTitleWide}>TODAY&apos;S QUESTS</Text>
          <TouchableOpacity
            style={[styles.addTaskButton, deletionPending && styles.addTaskButtonDisabled]}
            onPress={() => setRoutineModalVisible(true)}
            disabled={deletionPending}
            activeOpacity={0.8}
          >
            <Ionicons name="repeat" size={16} color="#0A0A0A" />
            <Text style={styles.addTaskButtonText}>Shuffle</Text>
          </TouchableOpacity>
        </View>

        {/* FILTER TABS ROW */}
        <View style={styles.filterTabsRow}>
          {/* TODO Tab */}
          <Pressable
            style={[
              styles.filterTab,
              activeTab === 'todo' ? styles.filterTabActive : styles.filterTabInactive,
            ]}
            onPress={() => setActiveTab('todo')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeTab === 'todo' ? styles.filterTabTextActive : styles.filterTabTextInactive,
              ]}
            >
              TODO
            </Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'todo' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'todo' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive,
                ]}
              >
                {todoQuests.length}
              </Text>
            </View>
          </Pressable>

          {/* DONE Tab */}
          <Pressable
            style={[
              styles.filterTab,
              activeTab === 'done' ? styles.filterTabActive : styles.filterTabInactive,
            ]}
            onPress={() => setActiveTab('done')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeTab === 'done' ? styles.filterTabTextActive : styles.filterTabTextInactive,
              ]}
            >
              DONE
            </Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'done' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'done' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive,
                ]}
              >
                {doneQuests.length}
              </Text>
            </View>
          </Pressable>

          {/* SKIPPED Tab */}
          <Pressable
            style={[
              styles.filterTab,
              activeTab === 'skipped' ? styles.filterTabActive : styles.filterTabInactive,
            ]}
            onPress={() => setActiveTab('skipped')}
          >
            <Text
              style={[
                styles.filterTabText,
                activeTab === 'skipped' ? styles.filterTabTextActive : styles.filterTabTextInactive,
              ]}
            >
              SKIPPED
            </Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'skipped' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'skipped' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive,
                ]}
              >
                {skippedQuests.length}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* CONDITIONALLY RENDER CONTENT BASED ON ACTIVE FILTER TAB */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E5A93C" />
          </View>
        ) : error ? (
          <View style={[styles.emptyStateCard, styles.errorCard]}>
            <Ionicons name="alert-circle-outline" size={56} color="#FF4D6D" />
            <Text style={styles.emptyStateTitle}>Error Loading Tasks</Text>
            <Text style={styles.emptyStateSubtext}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadTasks()}>
              <Text style={styles.retryButtonText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {activeTab === 'todo' && (
              <>
                {quests.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <Ionicons name="calendar-outline" size={56} color="#71717A" />
                    <Text style={styles.emptyStateTitle}>No Tasks Assigned</Text>
                    <Text style={styles.emptyStateSubtext}>
                      There are no tasks assigned to you for today.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* DAILY QUESTS Section or PEAK REACHED Banner */}
                    {dailyQuests.length > 0 && dailyTodoQuests.length === 0 ? (
                      <LinearGradient
                        colors={['#18181B', '#0E0E10']}
                        style={styles.peakReachedCard}
                      >
                        <View style={styles.peakReachedLeftCol}>
                          <View style={styles.peakHeaderRow}>
                            <Ionicons name="trophy" size={18} color="#E5A93C" style={{ marginRight: 6 }} />
                            <Text style={styles.peakReachedSubtag}>PEAK REACHED</Text>
                          </View>
                          <Text style={styles.peakReachedTitle}>Daily Quests Cleared!</Text>
                          <Text style={styles.peakReachedSubtext}>
                            All objectives successfully resolved for today. Arise, Hunter.
                          </Text>
                        </View>

                        {dayCleared && (
                          <TouchableOpacity
                            style={styles.peakShareBtn}
                            activeOpacity={0.85}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              openDayComplete();
                            }}
                          >
                            <Text style={styles.peakShareBtnText}>CELEBRATE</Text>
                            <Ionicons name="sparkles" size={14} color="#0A0A0A" />
                          </TouchableOpacity>
                        )}
                      </LinearGradient>
                    ) : dailyTodoQuests.length > 0 ? (
                      <>
                        <Text style={styles.sectionMonoLabel}>DAILY QUESTS</Text>
                        {dailyTodoQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="todo"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                          />
                        ))}
                      </>
                    ) : null}

                    {/* WEEKLY QUESTS Section */}
                    {weeklyTodoQuests.length > 0 && (
                      <>
                        <Text style={[styles.sectionMonoLabel, { marginTop: 24 }]}>WEEKLY QUESTS</Text>
                        {weeklyTodoQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="todo"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                          />
                        ))}
                      </>
                    )}

                    {/* MONTHLY QUESTS Section */}
                    {monthlyTodoQuests.length > 0 && (
                      <>
                        <Text style={[styles.sectionMonoLabel, { marginTop: 24 }]}>MONTHLY QUESTS</Text>
                        {monthlyTodoQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="todo"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                          />
                        ))}
                      </>
                    )}

                    {/* SPECIAL OFFERS (LOCKED PAID TASKS) */}
                    {lockedQuests.length > 0 && (
                      <>
                        <Text style={[styles.sectionMonoLabel, { marginTop: 24 }]}>SPECIAL OFFERS</Text>
                        {lockedQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="locked"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                            onBuy={handleOpenBuyModal}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* DONE TAB */}
            {activeTab === 'done' && (
              <>
                {doneQuests.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <ExactMedalIcon size={56} color="#71717A" />
                    <Text style={styles.emptyStateTitle}>Nothing Completed Yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Tap the tick box on any quest to update its status.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* DAILY QUESTS Section */}
                    {dailyDoneQuests.length > 0 && (
                      <>
                        <Text style={styles.sectionMonoLabel}>DAILY QUESTS</Text>
                        {dailyDoneQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="done"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                          />
                        ))}
                      </>
                    )}

                    {/* WEEKLY QUESTS Section */}
                    {weeklyDoneQuests.length > 0 && (
                      <>
                        <Text style={[styles.sectionMonoLabel, { marginTop: dailyDoneQuests.length > 0 ? 24 : 0 }]}>WEEKLY QUESTS</Text>
                        {weeklyDoneQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="done"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                          />
                        ))}
                      </>
                    )}

                    {/* MONTHLY QUESTS Section */}
                    {monthlyDoneQuests.length > 0 && (
                      <>
                        <Text style={[styles.sectionMonoLabel, { marginTop: (dailyDoneQuests.length > 0 || weeklyDoneQuests.length > 0) ? 24 : 0 }]}>
                          MONTHLY QUESTS
                        </Text>
                        {monthlyDoneQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="done"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* SKIPPED TAB */}
            {activeTab === 'skipped' && (
              <>
                {skippedQuests.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <Ionicons name="ban-outline" size={54} color="#71717A" />
                    <Text style={styles.emptyStateTitle}>No Skipped Quests</Text>
                    <Text style={styles.emptyStateSubtext}>
                      You haven't skipped any quests today.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* DAILY QUESTS Section */}
                    {dailySkippedQuests.length > 0 && (
                      <>
                        <Text style={styles.sectionMonoLabel}>DAILY QUESTS</Text>
                        {dailySkippedQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="skipped"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                          />
                        ))}
                      </>
                    )}

                    {/* WEEKLY QUESTS Section */}
                    {weeklySkippedQuests.length > 0 && (
                      <>
                        <Text style={[styles.sectionMonoLabel, { marginTop: dailySkippedQuests.length > 0 ? 24 : 0 }]}>WEEKLY QUESTS</Text>
                        {weeklySkippedQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="skipped"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                          />
                        ))}
                      </>
                    )}

                    {/* MONTHLY QUESTS Section */}
                    {monthlySkippedQuests.length > 0 && (
                      <>
                        <Text style={[styles.sectionMonoLabel, { marginTop: (dailySkippedQuests.length > 0 || weeklySkippedQuests.length > 0) ? 24 : 0 }]}>
                          MONTHLY QUESTS
                        </Text>
                        {monthlySkippedQuests.map((quest) => (
                          <QuestListCard
                            actionsDisabled={deletionPending}
                            key={quest.id}
                            quest={quest}
                            variant="skipped"
                            proteinGoal={user?.daily_protein_goal}
                            onComplete={handleOpenQuestActions}
                            onSkip={handleDirectSkip}
                            onReset={handleResetQuest}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      {/* Quest Action Selection Modal (Partial, Skip, Complete) */}
      <PaidTaskPurchaseModal
        visible={buyModalVisible}
        quest={selectedBuyQuest}
        onClose={() => setBuyModalVisible(false)}
        onConfirmPurchase={handleConfirmPurchase}
      />
      <ProofSubmitModal
        visible={!!proofQuest}
        questId={proofQuest?.id ?? ''}
        questTitle={proofQuest?.title ?? ''}
        xpReward={proofQuest?.xpReward ?? 0}
        proofCount={proofQuest?.proofCount ?? 1}
        resubmitNote={proofQuest?.reviewStatus === 'resubmit' ? proofQuest.reviewNote : null}
        onClose={() => setProofQuest(null)}
        onSubmitted={(data) => {
          const questId = proofQuest?.id;
          setProofQuest(null);
          setQuests((prev) =>
            prev.map((q) => (q.id === questId ? { ...q, status: 'done', reviewStatus: 'in_review', reviewNote: null } : q))
          );
          // Only streak unlocks can come now; XP and other rewards follow approval.
          if (data.streak_milestone) syncStreakBadges();
          (data.rewards_earned ?? []).forEach(showReward);
          showGlobalToast(`Proof sent! You'll get +${proofQuest?.xpReward ?? 0} XP once it's approved.`, 'success');
          loadTasks();
        }}
      />

      <RoutineTasksModal
        visible={routineModalVisible}
        onClose={() => setRoutineModalVisible(false)}
        onSaved={() => loadTasks()}
      />

      <QuestActionModal
        visible={actionModalVisible}
        questTitle={selectedQuest?.title ?? ''}
        questCategory={selectedQuest?.category ?? ''}
        xpReward={selectedQuest?.xpReward ?? 0}
        questTargetValue={selectedQuest?.targetValue ?? undefined}
        onClose={() => setActionModalVisible(false)}
        onFullComplete={() => {
          if (selectedQuest) {
            handleCompleteTask(selectedQuest.id, 'COMPLETED');
          }
          setActionModalVisible(false);
        }}
        onPartialComplete={() => {
          if (selectedQuest) {
            handleCompleteTask(selectedQuest.id, 'PARTIAL');
          }
          setActionModalVisible(false);
        }}
        onSkip={() => {
          if (selectedQuest) {
            handleCompleteTask(selectedQuest.id, 'SKIPPED');
          }
          setActionModalVisible(false);
        }}
      />
      {/* Loot Drop Modal */}
      <LootDropModal visible={dropVisible} rarity={lastDrop} onDismiss={() => setDropVisible(false)} />

      {/* Task-completed toast, error toast and first-quest sheet */}
      <HomeOverlays streakDays={displayStreak} weekStatus={user?.week_status} />

      {/* System Summon Push Notifications Priming Modal */}
      <PushPermissionModal
        visible={pushPrompt.visible}
        onEnable={pushPrompt.accept}
        onDismiss={pushPrompt.dismiss}
      />

      {/* Day Complete Modal Popup */}
      {showDayComplete && (
        <MissionResultsScreen
          key={dayCompleteKey}
          quests={quests}
          onContinue={() => setDayCompleteModalVisible(false)}
        />
      )}

      {/* Full-Screen Black View Fade-Out (Matches Intro Audio) */}
      {showBlackIntroOverlay && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: '#000000',
              opacity: blackFadeAnim,
              zIndex: 99999,
            },
          ]}
          pointerEvents="none"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* Peak Reached Completion Banner */
  peakReachedCard: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 20,
  },
  peakReachedLeftCol: {
    flex: 1,
    marginRight: 16,
  },
  peakReachedSubtag: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#FF6A00',
    letterSpacing: 1.5,
  },
  peakReachedTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    color: '#FFFFFF',
    marginTop: 4,
  },
  peakShareBtn: {
    backgroundColor: '#FAF8F5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  peakShareBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#0A0A0A',
    letterSpacing: 1,
  },
  screen: {
    backgroundColor: '#09090B',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },

  /* Top Header */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  userProfileGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 12,
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    position: 'relative',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#3F3F46',
  },
  levelBadgeCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#18181B',
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  userTitles: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  greetingText: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  xpSubtext: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#A1A1AA',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#191817',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#8A3B18',
    shadowColor: '#FF5500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  streakText: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#FE5B01',
    borderWidth: 1.5,
    borderColor: '#0A0A0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9.5,
    color: '#FFFFFF',
  },

  /* Active Campaign */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleWide: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  dayCounterText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#A1A1AA',
  },
  campaignCardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  campaignBgImage: {
    width: '100%',
    height: 180,
  },
  campaignBgStyle: {
    resizeMode: 'cover',
  },
  campaignOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 16,
    justifyContent: 'space-between',
  },
  campaignTitleContainer: {
    marginTop: 4,
  },
  campaignTitleLine: {
    fontFamily: fontFamilies.bold,
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 2,
    lineHeight: 32,
  },
  campaignDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  campaignDetailLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    color: '#A1A1AA',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  campaignDetailValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  /* Filter Tabs */
  questsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // WeeklyTracker above already leaves 12.
    marginTop: 12,
    marginBottom: 14,
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 14,
  },
  addTaskButtonDisabled: {
    opacity: 0.4,
  },
  addTaskButtonText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#0A0A0A',
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
  },
  filterTabActive: {
    backgroundColor: '#E4E4E7',
  },
  filterTabInactive: {
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  filterTabText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    letterSpacing: 0.8,
  },
  filterTabTextActive: {
    color: '#09090B',
  },
  filterTabTextInactive: {
    color: '#E4E4E7',
  },
  tabBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  tabBadgeInactive: {
    backgroundColor: '#27272A',
  },
  tabBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
  },
  tabBadgeTextActive: {
    color: '#09090B',
  },
  tabBadgeTextInactive: {
    color: '#A1A1AA',
  },

  /* Main Quests */
  sectionMonoLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: '#71717A',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  fullImageQuestCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#121215',
  },
  fullCardImageBg: {
    width: '100%',
    height: 145,
  },
  fullCardImageStyle: {
    resizeMode: 'cover',
  },
  fullCardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    padding: 14,
    justifyContent: 'space-between',
  },
  fullCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orangeXpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FE5B01',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  orangeXpBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  fullCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  fullCardTextCol: {
    flex: 1,
    paddingRight: 10,
    gap: 4,
  },
  fullCardTitleText: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  fullCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fullCardMetaText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: '#E4E4E7',
  },
  fullCardMetaDivider: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: '#71717A',
  },
  // Card-level quest styles (questCard, questImage*, xpBadge*, category*,
  // targetValue*, tick/wrong buttons, ...) moved to QuestListCard.tsx along
  // with the JSX that used them.
  creamSquareTickButtonChecked: {
    backgroundColor: '#22C55E',
  },
  categoryPillDivider: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: '#52525B',
  },
  questActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressSubtext: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#A1A1AA',
  },
  progressPercentText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#27272A',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E4E4E7',
    borderRadius: 2,
  },

  /* Daily Quests */
  dailyGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dailyCard: {
    flex: 1,
    backgroundColor: '#121215',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  dailyImageWrapper: {
    height: 140,
  },
  dailyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  dailyBody: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dailyTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    flex: 1,
  },
  dailyRewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dailyRewardText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#A1A1AA',
  },
  dailyProgressSubtext: {
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    color: '#A1A1AA',
  },
  dailyProgressPercentText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },

  /* Empty State Card */
  emptyStateCard: {
    backgroundColor: '#121215',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    height: 248,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  errorCard: {
    height: undefined,
    minHeight: 248,
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: '#A1A1AA',
    textAlign: 'center',
  },

  /* Badges & Reset Actions */
  doneBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  partialBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#27272A',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  peakHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  peakReachedSubtext: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#A1A1AA',
    marginTop: 4,
    lineHeight: 16,
  },
});
