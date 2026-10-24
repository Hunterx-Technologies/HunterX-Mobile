import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Clipboard,
  Linking,
  Dimensions,
  Animated,
  Platform,
  ActivityIndicator,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { fontFamilies } from '../../theme/typography';
import { RewardProductImage, REWARD_IMAGE_WIDTH } from './reward/RewardProductImage';
import { ConfirmDialog } from '../common/ConfirmDialog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  /** Extra terms shown under Details. */
  description?: string;
  /** Where "Redeem now" goes. Without one, only the "Redeem reward" button is offered. */
  amazonUrl?: string;
  isUsed?: boolean;
}

export interface RewardRevealModalProps {
  visible: boolean;
  onClose: () => void;
  reward: RewardRevealData | null;
  /** Shows a "Redeem" button (marks the reward used, after a confirm) while the reward is unused. */
  onMarkUsed?: () => void;
  /** Disables the button and shows progress while the request runs. */
  markingUsed?: boolean;
}

export const RewardRevealModal: React.FC<RewardRevealModalProps> = ({
  visible,
  onClose,
  reward,
  onMarkUsed,
  markingUsed = false,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : (RNStatusBar.currentHeight || 24));
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16);

  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [howToRedeemExpanded, setHowToRedeemExpanded] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRedeem, setConfirmRedeem] = useState(false);

  React.useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    }
  }, [visible]);

  if (!reward) return null;

  // Only the reward's own data is shown — never placeholder offers or codes.
  const currentSlide = reward;

  const handleCopyCode = () => {
    Clipboard.setString(currentSlide.code);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  };

  const handleRedeemNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    handleCopyCode();
    if (reward.amazonUrl) Linking.openURL(reward.amazonUrl).catch(() => {});
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
        {/* 1. HEADER (fixed above the scrolling content) */}
        <View style={[styles.headerBar, { paddingTop: topInset + 6 }]}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
              {reward.brandName || 'HunterX Reward'}
            </Text>
            {!!reward.brandName && <Text style={styles.sponsoredText}>Sponsored</Text>}
          </View>

          {/* Balances the ✕ so the title stays centered */}
          <View style={styles.headerIconBtn} />
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
                <RewardProductImage uri={reward.productImageUrl} width={REWARD_IMAGE_WIDTH.details} />
              </View>
            </View>

            {/* 3. OFFER HEADLINE & SUBTEXT (SYNCS WITH ACTIVE SLIDE) */}
            <View style={styles.offerSection}>
              <Text style={styles.offerHeadingText}>
                {currentSlide.offerHeading}
              </Text>
              {!!currentSlide.offerSubheading && (
                <Text style={styles.offerSubheadingText}>
                  {currentSlide.offerSubheading}
                </Text>
              )}
              {!!currentSlide.productName && (
                <Text style={styles.productNameHighlight}>
                  {currentSlide.productName}
                </Text>
              )}
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
                  {!!currentSlide.expiryDate && (
                    <View style={styles.bulletItem}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>Expires on {currentSlide.expiryDate}</Text>
                    </View>
                  )}
                  {!!currentSlide.minSpend && (
                    <View style={styles.bulletItem}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>Minimum {currentSlide.minSpend} spend.</Text>
                    </View>
                  )}
                  {!!reward.description && (
                    <View style={styles.bulletItem}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{reward.description}</Text>
                    </View>
                  )}
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
                      {reward.amazonUrl ? "Tap 'Redeem now' below or copy the code from above." : 'Copy the code from above.'}
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bulletDot}>2.</Text>
                    <Text style={styles.bulletText}>
                      Add {reward.productName ? `the ${reward.productName}` : 'your items'} to the cart.
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
                      Valid only on eligible products, until the expiry date.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* 8. BOTTOM STICKY CTA: REDEEM NOW */}
          <View style={[styles.stickyFooterContainer, { paddingBottom: bottomInset + 12 }]}>
            {(reward.isUsed || !!reward.amazonUrl) && (
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
            )}
            {!reward.isUsed && onMarkUsed && (
              <TouchableOpacity
                style={[
                  reward.amazonUrl ? styles.markUsedSecondaryBtn : styles.redeemNowBtn,
                  markingUsed && styles.markUsedBusy,
                ]}
                onPress={() => setConfirmRedeem(true)}
                disabled={markingUsed}
                activeOpacity={0.88}
              >
                {markingUsed ? (
                  <ActivityIndicator size="small" color={reward.amazonUrl ? '#FFFFFF' : '#0D0F12'} />
                ) : (
                  <Ionicons name={reward.amazonUrl ? 'checkmark-done' : 'gift'} size={18} color={reward.amazonUrl ? '#FFFFFF' : '#0D0F12'} />
                )}
                <Text style={reward.amazonUrl ? styles.markUsedSecondaryText : styles.redeemNowBtnText}>
                  {markingUsed ? 'Redeeming...' : reward.amazonUrl ? 'Mark as redeemed' : 'Redeem reward'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Redeeming moves the card to Used: make sure the code was used first. */}
          <ConfirmDialog
            visible={confirmRedeem}
            title="Redeem this reward?"
            message="Use your code at checkout first. Once redeemed, this reward moves to your Used tab."
            confirmLabel="Redeem"
            cancelLabel="Not yet"
            onConfirm={() => {
              setConfirmRedeem(false);
              onMarkUsed?.();
            }}
            onCancel={() => setConfirmRedeem(false)}
          />
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
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#121316',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#26282E',
  },
  headerTitleCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 17,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsoredText: {
    fontFamily: fontFamilies.regular,
    color: '#8E8E93',
    fontSize: 11.5,
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
    color: '#FE5B01',
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
  markUsedSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: 28,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#2A2C33',
  },
  markUsedSecondaryText: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  markUsedBusy: {
    opacity: 0.7,
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
