import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Share,
  Clipboard,
  Dimensions,
  Image,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ScratchCard, ScratchRarity } from '../components/features/ScratchCard';
import { HunterXCard } from '../components/features/HunterXCard';
import { HunterXEmblem } from '../components/features/HunterXEmblem';
import { RewardRevealModal } from '../components/features/RewardRevealModal';
import { TopographyPattern } from '../components/ui/TopographyPattern';
import { fontFamilies } from '../theme/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 32 - 14) / 2;
const GRID_CARD_HEIGHT = GRID_CARD_WIDTH * 1.54;

const CENTER_CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 310);
const CENTER_CARD_HEIGHT = CENTER_CARD_WIDTH * 1.52;

export type WalletTab = 'ACTIVE' | 'USED' | 'EXPIRED';

export interface CouponReward {
  id: string;
  badge: string;
  badgeType: 'voucher' | 'percent' | 'icon';
  iconName?: string;
  title: string;
  subtitle?: string;
  productName: string;
  productCategory: string;
  productIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  productImageUrl?: string;
  expiresIn: string;
  code: string;
  isScratched: boolean;
  isUsed: boolean;
  isExpired: boolean;
  rarity?: ScratchRarity;
}

const INITIAL_COUPONS: CouponReward[] = [
  {
    id: '1',
    badge: '$25 AMAZON VOUCHER',
    badgeType: 'voucher',
    iconName: 'amazon',
    title: 'AMAZON FITNESS STORE',
    subtitle: 'Redeemable on Gym & Fitness Gear',
    productName: 'Pro Resistance Bands Set (5-Pack)',
    productCategory: 'Strength & Mobility Kit',
    productIcon: 'dumbbell',
    productImageUrl: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?q=80&w=400&auto=format&fit=crop',
    expiresIn: '47:59:12',
    code: 'AMZ-BAND-25',
    isScratched: false,
    isUsed: false,
    isExpired: false,
    rarity: 'legendary',
  },
  {
    id: '2',
    badge: '$50 AMAZON VOUCHER',
    badgeType: 'voucher',
    iconName: 'amazon',
    title: 'AMAZON FITNESS STORE',
    subtitle: 'Redeemable on Gym & Fitness Gear',
    productName: 'Stainless Steel Gym Shaker 750ml',
    productCategory: 'Hydration & Nutrition Gear',
    productIcon: 'bottle-tonic-outline',
    productImageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?q=80&w=400&auto=format&fit=crop',
    expiresIn: '23:14:00',
    code: 'AMZ-SHAKE-50',
    isScratched: false,
    isUsed: false,
    isExpired: false,
    rarity: 'legendary',
  },
  {
    id: '3',
    badge: '$20 AMAZON VOUCHER',
    badgeType: 'voucher',
    iconName: 'amazon',
    title: 'AMAZON FITNESS STORE',
    subtitle: 'Redeemable on Gym & Fitness Gear',
    productName: 'Heavy-Duty Grip Weightlifting Gloves',
    productCategory: 'Lifting & Hand Protection',
    productIcon: 'hand-back-right',
    productImageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=400&auto=format&fit=crop',
    expiresIn: '12:15:44',
    code: 'AMZ-GLOVE-20',
    isScratched: true,
    isUsed: false,
    isExpired: false,
    rarity: 'epic',
  },
  {
    id: '4',
    badge: '$15 AMAZON VOUCHER',
    badgeType: 'voucher',
    iconName: 'amazon',
    title: 'AMAZON FITNESS STORE',
    subtitle: 'Redeemable on Gym & Fitness Gear',
    productName: 'High-Speed Bearing Skipping Rope',
    productCategory: 'Cardio & Speed Conditioning',
    productIcon: 'lightning-bolt',
    productImageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=400&auto=format&fit=crop',
    expiresIn: '08:42:19',
    code: 'AMZ-ROPE-15',
    isScratched: true,
    isUsed: false,
    isExpired: false,
    rarity: 'rare',
  },
  {
    id: '5',
    badge: '$30 AMAZON VOUCHER',
    badgeType: 'voucher',
    iconName: 'amazon',
    title: 'AMAZON FITNESS STORE',
    subtitle: 'Redeemable on Gym & Fitness Gear',
    productName: 'Heavy-Duty Wrist Support Wraps',
    productCategory: 'Powerlifting Accessories',
    productIcon: 'arm-flex',
    productImageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=400&auto=format&fit=crop',
    expiresIn: 'REDEEMED',
    code: 'AMZ-WRIST-30',
    isScratched: true,
    isUsed: true,
    isExpired: false,
    rarity: 'epic',
  },
  {
    id: '6',
    badge: '$10 AMAZON VOUCHER',
    badgeType: 'voucher',
    iconName: 'amazon',
    title: 'AMAZON FITNESS STORE',
    subtitle: 'Redeemable on Gym & Fitness Gear',
    productName: 'Electrolyte & Hydration Pack (30ct)',
    productCategory: 'Recovery Fuel & Minerals',
    productIcon: 'pill',
    productImageUrl: 'https://images.unsplash.com/photo-1546483875-ad9014c88eba?q=80&w=400&auto=format&fit=crop',
    expiresIn: 'CLAIMED',
    code: 'AMZ-ELECT-10',
    isScratched: true,
    isUsed: true,
    isExpired: false,
    rarity: 'common',
  },
  {
    id: '7',
    badge: '$40 AMAZON VOUCHER',
    badgeType: 'voucher',
    iconName: 'amazon',
    title: 'AMAZON FITNESS STORE',
    subtitle: 'Unopened Missed Drop',
    productName: 'Adjustable Forearm Grip Trainer',
    productCategory: 'Grip Strength Equipment',
    productIcon: 'dumbbell',
    productImageUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?q=80&w=400&auto=format&fit=crop',
    expiresIn: 'EXPIRED',
    code: 'AMZ-GRIP-40',
    isScratched: false,
    isUsed: false,
    isExpired: true,
    rarity: 'rare',
  },
  {
    id: '8',
    badge: '$35 AMAZON VOUCHER',
    badgeType: 'voucher',
    iconName: 'amazon',
    title: 'AMAZON FITNESS STORE',
    subtitle: 'Hunter Launch Special',
    productName: 'Deep Tissue Muscle Foam Roller',
    productCategory: 'Recovery & Mobility Gear',
    productIcon: 'circle-slice-8',
    productImageUrl: 'https://images.unsplash.com/photo-1600881333168-2ef49b341f30?q=80&w=400&auto=format&fit=crop',
    expiresIn: 'EXPIRED',
    code: 'AMZ-ROLL-35',
    isScratched: true,
    isUsed: false,
    isExpired: true,
    rarity: 'common',
  },
];

export default function RewardsScreen() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<CouponReward[]>(INITIAL_COUPONS);
  const [activeTab, setActiveTab] = useState<WalletTab>('ACTIVE');

  // Centered Active Scratch Card State (Card moves to center)
  const [activeCenterCard, setActiveCenterCard] = useState<CouponReward | null>(null);

  // Coupon detail modal state (for viewing full terms on already scratched cards)
  const [selectedDetailsCard, setSelectedDetailsCard] = useState<CouponReward | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const activeCards = coupons.filter((c) => !c.isUsed && !c.isExpired);
  const usedCards = coupons.filter((c) => c.isUsed);
  const expiredCards = coupons.filter((c) => c.isExpired);

  const getCurrentTabCards = () => {
    switch (activeTab) {
      case 'ACTIVE':
        return activeCards;
      case 'USED':
        return usedCards;
      case 'EXPIRED':
        return expiredCards;
      default:
        return activeCards;
    }
  };

  const handleCopyCode = (code: string) => {
    Clipboard.setString(code);
    setCopiedCode(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  // Tap Scratch Card -> If unscratched, open center to scratch. If already scratched, open full reward details.
  const handleCardPress = (card: CouponReward) => {
    Haptics.selectionAsync().catch(() => {});
    if (!card.isScratched && !card.isExpired) {
      setActiveCenterCard(card);
    } else {
      setSelectedDetailsCard(card);
    }
  };

  // Scratch completed directly on the centered card -> Immediately show the full reward reveal screen
  const handleCenterScratchComplete = () => {
    if (!activeCenterCard) return;

    const completedCard = activeCenterCard;
    const updatedCard: CouponReward = { ...completedCard, isScratched: true };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCoupons((prev) =>
      prev.map((c) => (c.id === completedCard.id ? updatedCard : c))
    );

    // Dismiss centered scratch layer and open the full Google Pay style reward reveal screen
    setActiveCenterCard(null);
    setSelectedDetailsCard(updatedCard);
  };

  const handleBack = () => {
    router.replace('/(tabs)/profile');
  };

  useEffect(() => {
    const onBackPress = () => {
      router.replace('/(tabs)/profile');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]);

  const handleMarkAsUsed = (cardId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCoupons((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isUsed: true, expiresIn: 'REDEEMED' } : c))
    );
    setSelectedDetailsCard(null);
  };

  return (
    <View style={styles.rootView}>
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

          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTag}>HUNTER LOOT VAULT</Text>
            <Text style={styles.headerTitle}>
              REWARDS <Text style={styles.orangeText}>CENTER</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerShareBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              Share.share({ message: '🔥 Check out my Hunter rewards and loot cards on Arise!' }).catch(() => {});
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social-outline" size={20} color="#F66F28" />
          </TouchableOpacity>
        </View>

        {/* SUMMARY STATS BANNER */}
        <View style={styles.statsBannerOuter}>
          <LinearGradient
            colors={['#16181C', '#121316']}
            style={styles.statsBannerGradient}
          >
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TOTAL DROPS</Text>
              <Text style={styles.statValue}>{coupons.length}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>UNOPENED</Text>
              <Text style={[styles.statValue, { color: '#F66F28' }]}>
                {coupons.filter((c) => !c.isScratched && !c.isExpired).length}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ACTIVE</Text>
              <Text style={[styles.statValue, { color: '#F2F2F2' }]}>{activeCards.length}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>REDEEMED</Text>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{usedCards.length}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* SEGMENTED 3 TABS (ACTIVE, USED, EXPIRED) */}
        <View style={styles.tabBarContainer}>
          {(['ACTIVE', 'USED', 'EXPIRED'] as WalletTab[]).map((tab) => {
            const isActive = activeTab === tab;
            let count = 0;
            if (tab === 'ACTIVE') count = activeCards.length;
            if (tab === 'USED') count = usedCards.length;
            if (tab === 'EXPIRED') count = expiredCards.length;

            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.75}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActiveTab(tab);
                  scrollRef.current?.scrollTo({ y: 0, animated: false });
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

        {/* 2-COLUMN SCRATCH CARD GRID */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollGridContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gridContainer}>
            {getCurrentTabCards().map((item) => {
              // 1. UNSCRATCHED CARD: Tapping moves it to the center of the screen
              if (!item.isScratched) {
                return (
                  <HunterXCard
                    key={item.id}
                    width={GRID_CARD_WIDTH}
                    height={GRID_CARD_HEIGHT}
                    isExpired={item.isExpired}
                    footerText={item.isExpired ? 'EXPIRED' : 'DRAG TO SCRATCH'}
                    onPress={() => handleCardPress(item)}
                  />
                );
              }

              // 2. SCRATCHED / REVEALED CARD (MATCHING GOOGLE PAY REFERENCE SCREENSHOT)
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.88}
                  style={[
                    styles.gridCardOuter,
                    {
                      width: GRID_CARD_WIDTH,
                      height: GRID_CARD_HEIGHT,
                    },
                    (item.isUsed || item.isExpired) && styles.dimmedCardOuter,
                  ]}
                  onPress={() => handleCardPress(item)}
                >
                  {/* Top Image Section */}
                  <View style={styles.gridTopImageSection}>
                    {item.productImageUrl ? (
                      <Image
                        source={{ uri: item.productImageUrl }}
                        style={styles.gridHeroProductImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.gridHeroFallback}>
                        <MaterialCommunityIcons name={item.productIcon || 'dumbbell'} size={32} color="#FF9900" />
                      </View>
                    )}

                    {/* Top-Left Circular Brand Badge (Amazon) */}
                    <View style={styles.gridBrandBadge}>
                      <FontAwesome5 name="amazon" size={12} color="#0D0F12" />
                    </View>

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
                      on orders above ₹800
                    </Text>
                    <Text style={styles.gridProductName} numberOfLines={1}>
                      {item.productName}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* EMPTY STATE */}
          {getCurrentTabCards().length === 0 && (
            <View style={styles.emptyContainer}>
              <HunterXEmblem size={64} glow={false} />
              <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} cards</Text>
              <Text style={styles.emptySub}>
                {activeTab === 'ACTIVE'
                  ? 'Complete daily hunter quests to earn Amazon fitness scratch cards!'
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
          onRequestClose={() => setActiveCenterCard(null)}
        >
          <View style={styles.centeredCardOverlay}>
            {/* Background Backdrop (Tap outside to close) */}
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setActiveCenterCard(null)}
            />

            {/* Floating Background-less Close Button */}
            <TouchableOpacity
              style={styles.floatingCloseBtn}
              onPress={() => setActiveCenterCard(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={26} color="#F2F2F2" />
            </TouchableOpacity>

            {/* The Scratch Card Centered Directly (No Dialog/Popup Chrome) */}
            {activeCenterCard && (
              <View style={styles.centeredCardContainer}>
                <ScratchCard
                  width={CENTER_CARD_WIDTH}
                  height={CENTER_CARD_HEIGHT}
                  isScratched={activeCenterCard.isScratched}
                  rewardText={activeCenterCard.badge}
                  rewardSubtitle={activeCenterCard.title}
                  productName={activeCenterCard.productName}
                  productCategory={activeCenterCard.productCategory}
                  productIcon={activeCenterCard.productIcon}
                  productImageUrl={activeCenterCard.productImageUrl}
                  code={activeCenterCard.code}
                  rarity={activeCenterCard.rarity || 'legendary'}
                  onComplete={handleCenterScratchComplete}
                />
              </View>
            )}
          </View>
        </Modal>

        {/* POST-SCRATCH REWARD REVEAL & INSPECTION MODAL (MATCHING REFERENCE SCREENSHOT) */}
        <RewardRevealModal
          visible={!!selectedDetailsCard}
          onClose={() => setSelectedDetailsCard(null)}
          reward={
            selectedDetailsCard
              ? {
                  id: selectedDetailsCard.id,
                  brandName: 'Amazon',
                  offerHeading: selectedDetailsCard.badge,
                  offerSubheading: 'on Amazon Fitness orders above ₹800',
                  code: selectedDetailsCard.code,
                  productName: selectedDetailsCard.productName,
                  productCategory: selectedDetailsCard.productCategory,
                  productImageUrl: selectedDetailsCard.productImageUrl,
                  expiryDate: selectedDetailsCard.expiresIn === 'EXPIRED' ? 'Expired' : 'October 9, 2026',
                  minSpend: '₹800',
                  amazonUrl: 'https://www.amazon.com',
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
  headerTitleCol: {
    flex: 1,
    marginLeft: 8,
  },
  headerTag: {
    fontFamily: fontFamilies.bold,
    color: '#777777',
    fontSize: 10,
    letterSpacing: 2,
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    color: '#F2F2F2',
    fontSize: 20,
    letterSpacing: 1,
  },
  orangeText: {
    color: '#F66F28',
  },
  headerShareBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* STATS BANNER */
  statsBannerOuter: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(246, 111, 40, 0.25)',
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
    borderColor: 'rgba(246, 111, 40, 0.6)',
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
    backgroundColor: '#F66F28',
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
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  gridContainer: {
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
  gridHeroProductImg: {
    width: '100%',
    height: '100%',
  },
  gridHeroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1C20',
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
    paddingHorizontal: 24,
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
    backgroundColor: '#F66F28',
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
    backgroundColor: '#F66F28',
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
