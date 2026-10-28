import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Clipboard,
  Dimensions,
  BackHandler,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, Redirect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ScratchCard, ScratchRarity, type ScratchCardStatus } from '../components/features/ScratchCard';
import { HunterXCard } from '../components/features/HunterXCard';
import { HunterXEmblem } from '../components/features/HunterXEmblem';
import { RewardRevealModal } from '../components/features/RewardRevealModal';
import { RewardProductImage, REWARD_IMAGE_WIDTH } from '../components/features/reward/RewardProductImage';
import { fontFamilies } from '../theme/typography';
import { useAuth } from '@/hooks/useAuth';
import { fetchRewards, markRewardUsed, scratchReward } from '@/services/api/rewards.service';
import { showGlobalToast } from '@/store/useToastStore';
import { hasPrize, rewardOriginLabel, type RewardTab, type RevealedReward, type UserReward } from '@/types/reward';
import { useAuthStore } from '@/store/useAuthStore';
import { API_ERROR, PENDING_DELETION_MESSAGE } from '@/services/api/errors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 32 - 14) / 2;
const GRID_CARD_HEIGHT = GRID_CARD_WIDTH * 1.54;

const CENTER_CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 310);
const CENTER_CARD_HEIGHT = CENTER_CARD_WIDTH * 1.52;

const TABS: RewardTab[] = ['ACTIVE', 'USED', 'EXPIRED'];
/** Start loading the next page this far (px) before the end of the list. */
const LOAD_MORE_OFFSET = 400;

export type WalletTab = RewardTab;

export interface CouponReward {
  id: string;
  badge: string;
  badgeType: 'voucher' | 'percent' | 'icon';
  iconName?: string;
  title: string;
  subtitle?: string;
  productName: string;
  productCategory: string;
  productImageUrl?: string;
  expiresIn: string;
  /** Long-form expiry for the details screen, e.g. "October 9, 2026"; null = no expiry. */
  expiryDate: string | null;
  code: string;
  isScratched: boolean;
  isUsed: boolean;
  isExpired: boolean;
  rarity?: ScratchRarity;
}

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

function formatDiscount(r: RevealedReward) {
  if (r.discount_value == null || !r.discount_type) return r.reward_text ?? 'REWARD';
  return r.discount_type === 'PERCENT' ? `${r.discount_value}% OFF` : `${r.currency ?? ''}${r.discount_value} OFF`;
}

/** Maps an API reward onto the wallet's card UI. Prize fields only exist once scratched. */
export function toCouponReward(r: UserReward): CouponReward {
  const prize = hasPrize(r) ? r : null;
  const expiryDate = formatDate(prize?.valid_until ?? r.expires_at);
  const isUsed = r.status === 'USED';
  const isExpired = r.status === 'EXPIRED';

  return {
    id: r.id,
    badge: prize ? formatDiscount(prize) : 'SCRATCH CARD',
    badgeType: prize?.discount_type === 'PERCENT' ? 'percent' : 'voucher',
    title: rewardOriginLabel(r),
    subtitle: r.description ?? undefined,
    productName: prize?.product_name ?? '',
    productCategory: prize?.product_category ?? '',
    productImageUrl: prize?.product_image_url,
    expiresIn: isUsed ? 'REDEEMED' : isExpired ? 'EXPIRED' : expiryDate ? `Expires ${expiryDate}` : 'No expiry',
    expiryDate,
    code: prize?.code ?? '',
    isScratched: !!prize,
    isUsed,
    isExpired,
    rarity: r.rarity,
  };
}

interface TabData {
  items: UserReward[];
  nextCursor: string | null;
  loaded: boolean;
  error: string | null;
}

const EMPTY_TAB: TabData = { items: [], nextCursor: null, loaded: false, error: null };

const errorCode = (err: unknown) => (err as { code?: string } | null)?.code;
const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

export default function RewardsScreen() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  // While the account waits to be deleted, cards can't be scratched or redeemed.
  const deletionPending = useAuthStore((s) => !!s.user?.deleteAt);
  const deletionPendingRef = useRef(deletionPending);
  deletionPendingRef.current = deletionPending;
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();

  const [activeTab, setActiveTab] = useState<WalletTab>('ACTIVE');
  const [tabs, setTabs] = useState<Record<WalletTab, TabData>>({ ACTIVE: EMPTY_TAB, USED: EMPTY_TAB, EXPIRED: EMPTY_TAB });
  const [counts, setCounts] = useState<Record<WalletTab, number> | null>(null);
  const [loading, setLoading] = useState<'initial' | 'refresh' | 'more' | null>(null);

  // Centered Active Scratch Card State (Card moves to center)
  const [activeCenterCard, setActiveCenterCard] = useState<CouponReward | null>(null);
  const [scratchStatus, setScratchStatus] = useState<ScratchCardStatus>('locked');
  /** Shown over the centered card; retry re-asks for the prize. */
  const [scratchNotice, setScratchNotice] = useState<{ message: string; retry: boolean } | null>(null);
  // One scratch request per card at a time.
  const scratchInFlight = useRef(new Set<string>());

  // Coupon detail modal state (for viewing full terms on already scratched cards)
  const [selectedDetailsCard, setSelectedDetailsCard] = useState<CouponReward | null>(null);
  const [markingUsed, setMarkingUsed] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  // Ignores responses for a tab that were overtaken by a newer request.
  const requestIds = useRef<Record<WalletTab, number>>({ ACTIVE: 0, USED: 0, EXPIRED: 0 });
  const focusHandled = useRef(false);

  useEffect(() => {
    const onBackPress = () => {
      router.replace('/(tabs)/profile');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]);

  const load = useCallback(async (tab: WalletTab, mode: 'initial' | 'refresh' | 'more', cursor?: string | null) => {
    const requestId = ++requestIds.current[tab];
    setLoading(mode);
    try {
      const page = await fetchRewards(tab, mode === 'more' ? cursor : null);
      if (requestId !== requestIds.current[tab]) return null;
      setTabs((prev) => ({
        ...prev,
        [tab]: {
          items: mode === 'more' ? [...prev[tab].items, ...page.items] : page.items,
          nextCursor: page.next_cursor,
          loaded: true,
          error: null,
        },
      }));
      if (page.counts) setCounts({ ACTIVE: page.counts.active, USED: page.counts.used, EXPIRED: page.counts.expired });
      return page.items;
    } catch (err) {
      if (requestId !== requestIds.current[tab]) return null;
      setTabs((prev) => ({ ...prev, [tab]: { ...prev[tab], loaded: true, error: errorText(err, 'Could not load your rewards.') } }));
      return null;
    } finally {
      if (requestId === requestIds.current[tab]) setLoading(null);
    }
  }, []);

  const refreshTab = useCallback((tab: WalletTab) => load(tab, 'refresh'), [load]);

  const openCard = useCallback((card: CouponReward) => {
    if (card.isExpired) return;
    if (!card.isScratched && deletionPendingRef.current) {
      showGlobalToast(PENDING_DELETION_MESSAGE, 'warning', 4000);
      return;
    }
    Haptics.selectionAsync().catch(() => { });
    if (!card.isScratched) {
      setScratchStatus('locked');
      setScratchNotice(null);
      setActiveCenterCard(card);
    } else {
      setSelectedDetailsCard(card);
    }
  }, []);

  // First load, then ?focus=<id> (from the reward screen or a push): find
  // the card's tab and open it straight away.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const active = await load('ACTIVE', 'initial');
      if (cancelled || !focus || focusHandled.current) return;
      focusHandled.current = true;
      let match = active?.find((r) => r.id === focus);
      let tab: WalletTab = 'ACTIVE';
      for (const other of ['USED', 'EXPIRED'] as WalletTab[]) {
        if (match || cancelled) break;
        match = (await load(other, 'initial'))?.find((r) => r.id === focus);
        tab = other;
      }
      if (!match || cancelled) return;
      setActiveTab(tab);
      openCard(toCouponReward(match));
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, focus, load, openCard]);

  // Other tabs load the first time they're opened (ACTIVE is loaded above).
  useEffect(() => {
    if (isAuthenticated && activeTab !== 'ACTIVE' && !tabs[activeTab].loaded && loading === null) load(activeTab, 'initial');
  }, [isAuthenticated, activeTab, tabs, loading, load]);

  if (isBootstrapping) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const current = tabs[activeTab];
  const currentCards = current.items.map(toCouponReward);
  const tabCount = (tab: WalletTab) => counts?.[tab] ?? tabs[tab].items.length;

  const replaceReward = (updated: UserReward) => {
    setTabs((prev) => {
      const next = { ...prev };
      for (const tab of TABS) {
        next[tab] = { ...prev[tab], items: prev[tab].items.map((r) => (r.id === updated.id ? updated : r)) };
      }
      return next;
    });
  };

  const handleCopyCode = (code: string) => {
    Clipboard.setString(code);
    setCopiedCode(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  const closeCenterCard = () => {
    setActiveCenterCard(null);
    setScratchNotice(null);
  };

  // First touch on the foil: the backend picks (or returns the already
  // picked) prize; it's drawn under the foil once it arrives.
  const startScratch = async () => {
    const card = activeCenterCard;
    if (!card || scratchInFlight.current.has(card.id)) return;
    scratchInFlight.current.add(card.id);
    setScratchStatus('loading');
    setScratchNotice(null);
    try {
      const revealed = await scratchReward(card.id);
      replaceReward(revealed);
      setActiveCenterCard((open) => (open?.id === card.id ? { ...toCouponReward(revealed), isScratched: false } : open));
      setScratchStatus('ready');
    } catch (err) {
      const code = errorCode(err);
      if (code === API_ERROR.ACCOUNT_PENDING_DELETION) {
        closeCenterCard();
        showGlobalToast(PENDING_DELETION_MESSAGE, 'warning', 4000);
      } else if (code === 'REWARD_EXPIRED' || code === 'REWARD_USED') {
        closeCenterCard();
        showGlobalToast(code === 'REWARD_EXPIRED' ? 'This reward has expired.' : 'This reward has already been used.', 'warning');
        refreshTab(activeTab);
      } else if (code === 'NO_COUPON_AVAILABLE') {
        setScratchStatus('locked');
        setScratchNotice({ message: 'Rewards are being restocked, try again later.', retry: false });
      } else {
        setScratchStatus('error');
        setScratchNotice({ message: "Couldn't reveal your card. Check your connection.", retry: true });
      }
    } finally {
      scratchInFlight.current.delete(card.id);
    }
  };

  // Scratch completed directly on the centered card -> Immediately show the full reward reveal screen
  const handleCenterScratchComplete = () => {
    if (!activeCenterCard) return;
    const completedCard: CouponReward = { ...activeCenterCard, isScratched: true };
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    closeCenterCard();
    setSelectedDetailsCard(completedCard);
  };

  const handleBack = () => {
    router.replace('/(tabs)/profile');
  };

  const handleMarkAsUsed = async (cardId: string) => {
    setMarkingUsed(true);
    try {
      await markRewardUsed(cardId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      setSelectedDetailsCard(null);
      showGlobalToast('Reward redeemed.', 'success');
    } catch (err) {
      const code = errorCode(err);
      if (code === API_ERROR.ACCOUNT_PENDING_DELETION) {
        showGlobalToast(PENDING_DELETION_MESSAGE, 'warning', 4000);
      } else if (code === 'REWARD_EXPIRED') {
        setSelectedDetailsCard(null);
        showGlobalToast('This reward has expired.', 'warning');
      } else {
        showGlobalToast(errorText(err, 'Could not redeem this reward.'), 'error');
      }
    } finally {
      setMarkingUsed(false);
      // The card moves between tabs, so every tab is reloaded.
      TABS.forEach((tab) => (tab === activeTab ? refreshTab(tab) : setTabs((prev) => ({ ...prev, [tab]: { ...prev[tab], loaded: false } }))));
    }
  };

  const showSkeleton = !current.loaded && !current.error;

  return (
    <View style={styles.rootView}>
      <StatusBar style="light" backgroundColor="#0D0F12" />
      {/* Background #0D0F12 */}
      <LinearGradient colors={['#0D0F12', '#0A0C0E', '#08090B']} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Toast Notification */}
        {copiedCode && (
          <View style={styles.toastContainer}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.toastText}>Code {copiedCode} copied to clipboard!</Text>
          </View>
        )}

        {/* HEADER BAR (strictly adhering to project rules: background-less back button) */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Rewards</Text>

          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView
          overScrollMode="never"
          ref={scrollRef}
          contentContainerStyle={styles.scrollGridContent}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
          scrollEventThrottle={32}
          refreshControl={
            <RefreshControl
              refreshing={loading === 'refresh'}
              onRefresh={() => refreshTab(activeTab)}
              tintColor="#FE5B01"
              colors={['#FE5B01']}
            />
          }
          onScroll={(e) => {
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            scrollYRef.current = contentOffset.y;
            const nearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - LOAD_MORE_OFFSET;
            if (nearEnd && current.nextCursor && loading === null) load(activeTab, 'more', current.nextCursor);
          }}
        >
          {/* Sticky tabs: solid background so cards don't show through */}
          <View style={styles.stickyTabsWrap}>
            {/* SEGMENTED 3 TABS (ACTIVE, USED, EXPIRED) */}
            <View style={styles.tabBarContainer}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                const count = tabCount(tab);

                return (
                  <TouchableOpacity
                    key={tab}
                    activeOpacity={0.75}
                    style={[styles.tabItem, isActive && styles.tabItemActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => { });
                      setActiveTab(tab);
                      if (scrollYRef.current > 0) {
                        scrollRef.current?.scrollTo({ y: 0, animated: false });
                      }
                    }}
                  >
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {tab}
                    </Text>
                    <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                      <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* LOADING SKELETON */}
          {showSkeleton && (
            <View style={styles.gridContainer}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.skeletonCard, { width: GRID_CARD_WIDTH, height: GRID_CARD_HEIGHT }]} />
              ))}
            </View>
          )}

          {/* ERROR STATE */}
          {current.error && current.items.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={44} color="#777777" />
              <Text style={styles.emptyTitle}>Couldn&apos;t load rewards</Text>
              <Text style={styles.emptySub}>{current.error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => load(activeTab, 'initial')} activeOpacity={0.8}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 2-COLUMN SCRATCH CARD GRID */}
          <View style={styles.gridContainer}>
            {currentCards.map((item) => {
              // 1. UNSCRATCHED CARD: Tapping moves it to the center of the screen
              if (!item.isScratched) {
                return (
                  <HunterXCard
                    key={item.id}
                    width={GRID_CARD_WIDTH}
                    height={GRID_CARD_HEIGHT}
                    isExpired={item.isExpired}
                    footerText={item.isExpired ? 'EXPIRED' : 'DRAG TO SCRATCH'}
                    onPress={() => openCard(item)}
                  />
                );
              }

              // 2. SCRATCHED / REVEALED CARD (MATCHING GOOGLE PAY REFERENCE SCREENSHOT)
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={item.isExpired ? 1 : 0.88}
                  disabled={item.isExpired}
                  style={[
                    styles.gridCardOuter,
                    {
                      width: GRID_CARD_WIDTH,
                      height: GRID_CARD_HEIGHT,
                    },
                    (item.isUsed || item.isExpired) && styles.dimmedCardOuter,
                  ]}
                  onPress={() => openCard(item)}
                >
                  {/* Top Image Section */}
                  <View style={styles.gridTopImageSection}>
                    <RewardProductImage uri={item.productImageUrl} width={REWARD_IMAGE_WIDTH.grid} />

                    {/* Top-Right Status Tag */}
                    <View
                      style={[
                        styles.gridStatusBadge,
                        item.isUsed
                          ? styles.statusBadgeUsed
                          : item.isExpired
                            ? styles.statusBadgeExpired
                            : styles.statusBadgeNew,
                      ]}
                    >
                      <Text
                        style={[
                          styles.gridStatusText,
                          item.isUsed
                            ? styles.statusTextUsed
                            : item.isExpired
                              ? styles.statusTextExpired
                              : styles.statusTextNew,
                        ]}
                      >
                        {item.isUsed ? 'USED' : item.isExpired ? 'EXPIRED' : 'New'}
                      </Text>
                    </View>
                  </View>

                  {/* Bottom Info Section */}
                  <View style={styles.gridBottomInfoSection}>
                    <Text style={styles.gridOfferHeading} numberOfLines={1}>
                      {item.badge}
                    </Text>
                    <Text style={styles.gridOfferSubtext} numberOfLines={1}>
                      {item.expiresIn}
                    </Text>
                    <Text style={styles.gridProductName} numberOfLines={1}>
                      {item.productName || item.title}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading === 'more' && <ActivityIndicator style={styles.loadMoreSpinner} color="#FE5B01" />}

          {/* EMPTY STATE */}
          {current.loaded && !current.error && currentCards.length === 0 && (
            <View style={styles.emptyContainer}>
              <HunterXEmblem size={64} glow={false} />
              <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} cards</Text>
              <Text style={styles.emptySub}>
                {activeTab === 'ACTIVE'
                  ? 'Earn scratch cards at streak milestones, on level-ups and on your birthday!'
                  : activeTab === 'USED'
                    ? 'Redeemed coupons and claimed rewards will appear here.'
                    : 'Expired scratch cards and rewards will be archived here.'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ============================================================== */}
        {/* CENTERED SCRATCH CARD LAYER (Card moves to center of screen)   */}
        {/* ============================================================== */}
        <Modal
          visible={!!activeCenterCard}
          transparent
          animationType="fade"
          onRequestClose={closeCenterCard}
        >
          <View style={styles.centeredCardOverlay}>
            {/* Background Backdrop (Tap outside to close) */}
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={closeCenterCard}
            />

            {/* The Scratch Card Centered Directly (No Dialog/Popup Chrome) */}
            {activeCenterCard && (
              <View style={styles.centeredCardContainer}>
                <ScratchCard
                  key={activeCenterCard.id}
                  width={CENTER_CARD_WIDTH}
                  height={CENTER_CARD_HEIGHT}
                  status={scratchStatus}
                  onScratchStart={startScratch}
                  rewardText={activeCenterCard.badge}
                  rewardSubtitle={activeCenterCard.expiresIn}
                  productName={activeCenterCard.productName || activeCenterCard.title}
                  productImageUrl={activeCenterCard.productImageUrl}
                  code={activeCenterCard.code || undefined}
                  rarity={activeCenterCard.rarity || 'legendary'}
                  onComplete={handleCenterScratchComplete}
                />
                {scratchNotice && (
                  <View style={styles.scratchNotice}>
                    <Ionicons name="alert-circle-outline" size={16} color="#FE5B01" />
                    <Text style={styles.scratchNoticeText}>{scratchNotice.message}</Text>
                    {scratchNotice.retry && (
                      <TouchableOpacity onPress={startScratch} activeOpacity={0.7}>
                        <Text style={styles.scratchNoticeRetry}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </Modal>

        {/* POST-SCRATCH REWARD REVEAL & INSPECTION MODAL (MATCHING REFERENCE SCREENSHOT) */}
        <RewardRevealModal
          visible={!!selectedDetailsCard}
          onClose={() => setSelectedDetailsCard(null)}
          onMarkUsed={selectedDetailsCard && !deletionPending ? () => handleMarkAsUsed(selectedDetailsCard.id) : undefined}
          markingUsed={markingUsed}
          reward={
            selectedDetailsCard
              ? {
                id: selectedDetailsCard.id,
                offerHeading: selectedDetailsCard.badge,
                code: selectedDetailsCard.code,
                productName: selectedDetailsCard.productName,
                productCategory: selectedDetailsCard.productCategory,
                productImageUrl: selectedDetailsCard.productImageUrl,
                expiryDate: selectedDetailsCard.expiryDate ?? undefined,
                description: selectedDetailsCard.subtitle,
                isUsed: selectedDetailsCard.isUsed,
              }
              : null
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootView: {
    flex: 1,
    backgroundColor: '#0D0F12',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16181C',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontFamily: fontFamilies.medium,
    color: '#F2F2F2',
    fontSize: 13,
    fontWeight: '600',
  },

  /* HEADER */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  headerRightSpacer: {
    width: 38,
  },

  /* STATS BANNER */
  statsBannerOuter: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.25)',
    overflow: 'hidden',
  },
  statsBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: fontFamilies.bold,
    color: '#777777',
    fontSize: 8.5,
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: fontFamilies.bold,
    color: '#F2F2F2',
    fontSize: 17,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#292829',
  },

  /* 3 SEGMENTED TABS */
  tabBarContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#16181C',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#292829',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#292829',
    borderWidth: 1,
    borderColor: 'rgba(254, 91, 1, 0.6)',
  },
  tabText: {
    fontFamily: fontFamilies.bold,
    color: '#777777',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: '#F2F2F2',
  },
  tabBadge: {
    backgroundColor: '#292829',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: '#FE5B01',
  },
  tabBadgeText: {
    fontFamily: fontFamilies.bold,
    color: '#B8B8B8',
    fontSize: 10,
  },
  tabBadgeTextActive: {
    color: '#0D0F12',
  },

  /* 2-COLUMN GRID */
  scrollGridContent: {
    paddingBottom: 40,
  },
  stickyTabsWrap: {
    backgroundColor: '#0D0F12',
    paddingTop: 8,
  },
  gridContainer: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },

  /* SCRATCHED / REVEALED GRID CARD (MATCHING GOOGLE PAY REFERENCE) */
  gridCardOuter: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#26282E',
    overflow: 'hidden',
    backgroundColor: '#121316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  dimmedCardOuter: {
    opacity: 0.55,
  },
  gridTopImageSection: {
    width: '100%',
    height: '54%',
    backgroundColor: '#1A1C20',
    position: 'relative',
    overflow: 'hidden',
  },
  gridBrandBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  gridStatusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  statusBadgeNew: {
    backgroundColor: '#154726',
  },
  statusBadgeUsed: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  statusBadgeExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  gridStatusText: {
    fontFamily: fontFamilies.bold,
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  statusTextNew: {
    color: '#4ADE80',
  },
  statusTextUsed: {
    color: '#10B981',
  },
  statusTextExpired: {
    color: '#EF4444',
  },
  gridBottomInfoSection: {
    width: '100%',
    height: '46%',
    backgroundColor: '#121316',
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  gridOfferHeading: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  gridOfferSubtext: {
    fontFamily: fontFamilies.regular,
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 2,
  },
  gridProductName: {
    fontFamily: fontFamilies.semiBold,
    color: '#FF9900',
    fontSize: 9.5,
    marginTop: 2,
  },

  /* EMPTY STATE */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: fontFamilies.bold,
    color: '#F2F2F2',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  emptySub: {
    fontFamily: fontFamilies.regular,
    color: '#777777',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#27272A',
  },
  retryBtnText: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  skeletonCard: {
    borderRadius: 18,
    backgroundColor: '#16181C',
    borderWidth: 1,
    borderColor: '#1E2024',
  },
  loadMoreSpinner: {
    marginVertical: 20,
  },
  scratchNotice: {
    marginTop: 16,
    maxWidth: CENTER_CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16181C',
    borderWidth: 1,
    borderColor: '#2A2C33',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scratchNoticeText: {
    flexShrink: 1,
    fontFamily: fontFamilies.medium,
    color: '#F2F2F2',
    fontSize: 12.5,
  },
  scratchNoticeRetry: {
    fontFamily: fontFamilies.bold,
    color: '#FE5B01',
    fontSize: 13,
  },

  /* ============================================================== */
  /* CENTERED SCRATCH CARD OVERLAY                                  */
  /* ============================================================== */
  centeredCardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 15, 18, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  floatingCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  centeredCardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* DETAILS MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 15, 18, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#292829',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  detailsModalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#16181C',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#292829',
    padding: 20,
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  detailsBadgeBox: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#0D0F12',
    borderWidth: 1,
    borderColor: '#292829',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsProductImg: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  detailsBadgeText: {
    fontFamily: fontFamilies.bold,
    color: '#FF9900',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  detailsTitle: {
    fontFamily: fontFamilies.bold,
    color: '#F2F2F2',
    fontSize: 14,
    marginTop: 1,
  },
  detailsSubtitle: {
    fontFamily: fontFamilies.regular,
    color: '#B8B8B8',
    fontSize: 11,
    marginTop: 2,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#292829',
    marginVertical: 16,
  },
  detailCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D0F12',
    borderWidth: 1,
    borderColor: '#292829',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  detailCodeLabel: {
    fontFamily: fontFamilies.bold,
    color: '#777777',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  detailCodeVal: {
    fontFamily: fontFamilies.bold,
    color: '#F2F2F2',
    fontSize: 15,
    letterSpacing: 2,
    marginTop: 2,
  },
  detailCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FE5B01',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailCopyBtnText: {
    fontFamily: fontFamilies.bold,
    color: '#0D0F12',
    fontSize: 11,
  },
  termsText: {
    fontFamily: fontFamilies.regular,
    color: '#777777',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 18,
  },
  useNowBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  useNowBtnText: {
    fontFamily: fontFamilies.bold,
    color: '#0D0F12',
    fontSize: 13,
    letterSpacing: 1,
  },
  disabledStatusBanner: {
    backgroundColor: '#292829',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledStatusText: {
    fontFamily: fontFamilies.bold,
    color: '#777777',
    fontSize: 12,
    letterSpacing: 1,
  },
});
