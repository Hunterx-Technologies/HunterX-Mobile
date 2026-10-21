import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  Clipboard,
  Share,
  Linking,
  Dimensions,
  Animated,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import * as Haptics from 'expo-haptics';
import { fontFamilies } from '../../theme/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface RewardSlideItem {
  id: string;
  imageUrl: string;
  offerHeading: string;
  offerSubheading: string;
  productName: string;
  productCategory: string;
  code: string;
  minSpend?: string;
  expiryDate?: string;
}

const DEFAULT_FITNESS_SLIDES: RewardSlideItem[] = [
  {
    id: '1',
    imageUrl: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?q=80&w=800&auto=format&fit=crop',
    offerHeading: '$25 AMAZON VOUCHER',
    offerSubheading: 'on Amazon Fitness orders above ₹800',
    productName: 'Pro Resistance Bands Set (5-Pack)',
    productCategory: 'Strength & Mobility Kit',
    code: 'AMZ-BAND-25',
    minSpend: '₹800',
    expiryDate: 'October 9, 2026',
  },
  {
    id: '2',
    imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?q=80&w=800&auto=format&fit=crop',
    offerHeading: '$50 AMAZON VOUCHER',
    offerSubheading: 'on Amazon Fitness orders above ₹1,000',
    productName: 'Stainless Steel Gym Shaker 750ml',
    productCategory: 'Hydration & Nutrition Gear',
    code: 'AMZ-SHAKE-50',
    minSpend: '₹1,000',
    expiryDate: 'October 9, 2026',
  },
  {
    id: '3',
    imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=800&auto=format&fit=crop',
    offerHeading: '$20 AMAZON VOUCHER',
    offerSubheading: 'on Amazon Fitness orders above ₹600',
    productName: 'Heavy-Duty Grip Weightlifting Gloves',
    productCategory: 'Lifting & Hand Protection',
    code: 'AMZ-GLOVE-20',
    minSpend: '₹600',
    expiryDate: 'October 9, 2026',
  },
  {
    id: '4',
    imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=800&auto=format&fit=crop',
    offerHeading: '$15 AMAZON VOUCHER',
    offerSubheading: 'on Amazon Fitness orders above ₹500',
    productName: 'High-Speed Bearing Skipping Rope',
    productCategory: 'Cardio & Speed Conditioning',
    code: 'AMZ-ROPE-15',
    minSpend: '₹500',
    expiryDate: 'October 9, 2026',
  },
  {
    id: '5',
    imageUrl: 'https://images.unsplash.com/photo-1600881333168-2ef49b341f30?q=80&w=800&auto=format&fit=crop',
    offerHeading: '$35 AMAZON VOUCHER',
    offerSubheading: 'on Amazon Fitness orders above ₹800',
    productName: 'Deep Tissue Muscle Foam Roller',
    productCategory: 'Recovery & Mobility Gear',
    code: 'AMZ-ROLL-35',
    minSpend: '₹800',
    expiryDate: 'October 9, 2026',
  },
];

export interface RewardRevealData {
  id?: string;
  brandName?: string;
  brandAvatarUrl?: string;
  offerHeading?: string;
  offerSubheading?: string;
  code: string;
  productName: string;
  productCategory?: string;
  productImageUrl?: string;
  productImages?: string[];
  expiryDate?: string;
  minSpend?: string;
  amazonUrl?: string;
  isUsed?: boolean;
}

export interface RewardRevealModalProps {
  visible: boolean;
  onClose: () => void;
  reward: RewardRevealData | null;
}

export const RewardRevealModal: React.FC<RewardRevealModalProps> = ({
  visible,
  onClose,
  reward,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : (RNStatusBar.currentHeight || 24));
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16);

  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [howToRedeemExpanded, setHowToRedeemExpanded] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  React.useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    }
  }, [visible]);

  // Combine passed reward with 4 other distinct gym/fitness slides for 5 total slides
  const slides: RewardSlideItem[] = React.useMemo(() => {
    if (!reward) return DEFAULT_FITNESS_SLIDES;

    const firstSlide: RewardSlideItem = {
      id: reward.id || '1',
      imageUrl: reward.productImageUrl || DEFAULT_FITNESS_SLIDES[0].imageUrl,
      offerHeading: reward.offerHeading || DEFAULT_FITNESS_SLIDES[0].offerHeading,
      offerSubheading: reward.offerSubheading || DEFAULT_FITNESS_SLIDES[0].offerSubheading,
      productName: reward.productName || DEFAULT_FITNESS_SLIDES[0].productName,
      productCategory: reward.productCategory || DEFAULT_FITNESS_SLIDES[0].productCategory,
      code: reward.code || DEFAULT_FITNESS_SLIDES[0].code,
      minSpend: reward.minSpend || DEFAULT_FITNESS_SLIDES[0].minSpend,
      expiryDate: reward.expiryDate || DEFAULT_FITNESS_SLIDES[0].expiryDate,
    };

    const remainingSlides = DEFAULT_FITNESS_SLIDES.filter(
      (s) => s.id !== firstSlide.id && s.code !== firstSlide.code
    ).slice(0, 4);

    return [firstSlide, ...remainingSlides];
  }, [reward]);

  if (!reward) return null;

  const currentSlide = slides[activeSlideIndex] || slides[0];

  const handleCopyCode = () => {
    Clipboard.setString(currentSlide.code);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const shareImage = reward?.productImageUrl || currentSlide.imageUrl;
    const offerHeading = currentSlide.offerHeading || 'Exclusive Reward';
    const productName = currentSlide.productName || 'Fitness Gear';

    const message = `🎯 Grab this offer that I got on HunterX!\n\n🎁 Reward: ${offerHeading}\n📦 Product: ${productName}\n\nIf you're not a part of HunterX yet, join us today and start earning real rewards!\n\n${shareImage ? `🔗 View Offer: ${shareImage}` : ''}`;

    Share.share({
      title: `HunterX Reward: ${offerHeading}`,
      message,
      url: shareImage || undefined,
    }).catch(() => {});
  };

  const handleRedeemNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    handleCopyCode();
    const targetUrl = reward.amazonUrl || 'https://www.amazon.com';
    Linking.openURL(targetUrl).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar style="light" backgroundColor="#121316" />
      <View style={styles.root}>
        {/* 1. TOP HEADER BAR */}
        <View style={[styles.headerBar, { paddingTop: topInset + 6 }]}>
          {/* Left: Close Button */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Center: Brand Info (Amazon) */}
          <View style={styles.headerBrandCol}>
            <View style={styles.brandAvatarBox}>
              <FontAwesome5 name="amazon" size={16} color="#0D0F12" />
            </View>
            <View style={styles.brandTextCol}>
              <Text style={styles.brandNameText}>
                {reward.brandName || 'Amazon'}
              </Text>
              <View style={styles.sponsoredRow}>
                <Text style={styles.sponsoredText}>Sponsored</Text>
                <Ionicons name="information-circle-outline" size={13} color="#8E8E93" />
              </View>
            </View>
          </View>

          {/* Right: Action (Share Only) */}
          <View style={styles.headerActionsRow}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* MAIN SCROLLABLE CONTENT */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 2. PRODUCT HERO IMAGE (SINGLE IMAGE PER REWARD) */}
            <View style={styles.heroCarouselContainer}>
              <View style={styles.heroCardSlide}>
                <Image
                  source={{ uri: reward.productImageUrl || currentSlide.imageUrl }}
                  style={styles.heroProductImage}
                  resizeMode="cover"
                />
              </View>
            </View>

            {/* 3. OFFER HEADLINE & SUBTEXT (SYNCS WITH ACTIVE SLIDE) */}
            <View style={styles.offerSection}>
              <Text style={styles.offerHeadingText}>
                {currentSlide.offerHeading}
              </Text>
              <Text style={styles.offerSubheadingText}>
                {currentSlide.offerSubheading}
              </Text>
              <Text style={styles.productNameHighlight}>
                {currentSlide.productName}
              </Text>
            </View>

            {/* 4. PROMO CODE / CLAIM PILL BOX (SYNCS WITH ACTIVE SLIDE) */}
            <View style={styles.codeContainer}>
              <Text style={styles.codeDisplayText}>
                {copied ? currentSlide.code : '••••••••••••'}
              </Text>
              <TouchableOpacity
                style={styles.codeActionBtn}
                onPress={handleCopyCode}
                activeOpacity={0.7}
              >
                <Text style={styles.codeActionText}>
                  {copied ? 'Copied!' : 'Get code'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 5. ACCORDION 1: DETAILS */}
            <View style={styles.accordionGroup}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setDetailsExpanded((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.accordionTitle}>Details</Text>
                <Ionicons
                  name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              {detailsExpanded && (
                <View style={styles.accordionBody}>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      Expires on {currentSlide.expiryDate || 'October 9, 2026'}
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      Minimum {currentSlide.minSpend || '₹800'} spend.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      Amazon Fitness is a high-performance verified gear & equipment store.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>Offer valid for all users.</Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      The voucher cannot be clubbed with any Free Gift offer on the website.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      Free shipping on eligible Prime & prepaid orders.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      Customer support: support@hunterx.app
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* 6. ACCORDION 2: HOW TO REDEEM */}
            <View style={styles.accordionGroup}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setHowToRedeemExpanded((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.accordionTitle}>How to redeem</Text>
                <Ionicons
                  name={howToRedeemExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              {howToRedeemExpanded && (
                <View style={styles.accordionBody}>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>1.</Text>
                    <Text style={styles.bulletText}>
                      Tap 'Redeem now' below or copy the code from above.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>2.</Text>
                    <Text style={styles.bulletText}>
                      Add your gym gear ({reward.productName}) to the Amazon cart.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>3.</Text>
                    <Text style={styles.bulletText}>
                      Apply the coupon code at checkout to enjoy instant discount.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* 7. ACCORDION 3: TERMS & CONDITIONS */}
            <View style={styles.accordionGroup}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setTermsExpanded((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.accordionTitle}>Terms & conditions</Text>
                <Ionicons
                  name={termsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              {termsExpanded && (
                <View style={styles.accordionBody}>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      This voucher is single-use and non-transferable.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      Valid only on eligible products in the fitness & sports category.
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      Standard Amazon terms and return policies apply.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* 8. BOTTOM STICKY CTA: REDEEM NOW */}
          <View style={[styles.stickyFooterContainer, { paddingBottom: bottomInset + 12 }]}>
            <TouchableOpacity
              style={[
                styles.redeemNowBtn,
                reward.isUsed && styles.disabledRedeemBtn,
              ]}
              onPress={handleRedeemNow}
              disabled={reward.isUsed}
              activeOpacity={0.88}
            >
              <Ionicons
                name={reward.isUsed ? 'checkmark-circle' : 'open-outline'}
                size={18}
                color={reward.isUsed ? '#8E8E93' : '#0D0F12'}
              />
              <Text
                style={[
                  styles.redeemNowBtnText,
                  reward.isUsed && styles.disabledRedeemBtnText,
                ]}
              >
                {reward.isUsed ? 'REDEEMED' : 'Redeem now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#121316',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#121316',
  },

  /* HEADER */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 6,
  },
  brandAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextCol: {
    justifyContent: 'center',
  },
  brandNameText: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  sponsoredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  sponsoredText: {
    fontFamily: fontFamilies.regular,
    color: '#8E8E93',
    fontSize: 11.5,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  /* MAIN SCROLL */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },

  /* HERO PRODUCT CAROUSEL */
  heroCarouselContainer: {
    width: '100%',
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    marginBottom: 20,
  },
  carouselTrack: {
    alignItems: 'center',
  },
  heroCardSlide: {
    width: SCREEN_WIDTH - 32,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  heroProductImage: {
    width: '100%',
    height: '100%',
  },
  slideIndicatorBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  slideIndicatorText: {
    fontFamily: fontFamilies.medium,
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },

  /* OFFER SECTION */
  offerSection: {
    marginBottom: 18,
  },
  offerHeadingText: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 24,
    letterSpacing: 0.2,
  },
  offerSubheadingText: {
    fontFamily: fontFamilies.regular,
    color: '#A0A0A0',
    fontSize: 14,
    marginTop: 4,
  },
  productNameHighlight: {
    fontFamily: fontFamilies.semiBold,
    color: '#FF9900',
    fontSize: 13,
    marginTop: 4,
  },

  /* PROMO CODE PILL */
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E2024',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#292A2E',
  },
  codeDisplayText: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 2,
  },
  codeActionBtn: {
    paddingLeft: 12,
  },
  codeActionText: {
    fontFamily: fontFamilies.bold,
    color: '#F66F28',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  /* ACCORDIONS */
  accordionGroup: {
    paddingVertical: 12,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  accordionTitle: {
    fontFamily: fontFamilies.semiBold,
    color: '#FFFFFF',
    fontSize: 16,
  },
  accordionBody: {
    paddingTop: 12,
    gap: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    color: '#CCCCCC',
    fontSize: 13,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#292A2E',
    marginVertical: 4,
  },

  /* BOTTOM STICKY FOOTER */
  stickyFooterContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E2024',
    backgroundColor: '#121316',
  },
  redeemNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 14,
  },
  disabledRedeemBtn: {
    backgroundColor: '#1E2024',
    borderWidth: 1,
    borderColor: '#2A2C33',
  },
  redeemNowBtnText: {
    fontFamily: fontFamilies.bold,
    color: '#0D0F12',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  disabledRedeemBtnText: {
    color: '#8E8E93',
  },
});
