import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fontFamilies } from "@/theme/typography";
import type { QuestItem } from "@/app/(tabs)/index";

export interface PaidTaskPurchaseModalProps {
  visible: boolean;
  quest: QuestItem | null;
  onClose: () => void;
  onConfirmPurchase: (quest: QuestItem) => void;
}

export function PaidTaskPurchaseModal({
  visible,
  quest,
  onClose,
  onConfirmPurchase,
}: PaidTaskPurchaseModalProps) {
  if (!quest) return null;

  const handleBuyPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirmPurchase(quest);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Header Image with close button */}
          <View style={styles.imageContainer}>
            {quest.image ? (
              <ExpoImage
                source={quest.image}
                style={styles.image}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={["#27272A", "#18181B"]}
                style={styles.imagePlaceholder}
              />
            )}
            <LinearGradient
              colors={["transparent", "rgba(14, 14, 17, 0.95)"]}
              style={styles.imageOverlay}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color="#F59E0B" />
              <Text style={styles.lockBadgeText}>PREMIUM QUEST</Text>
            </View>
          </View>

          {/* Body Content */}
          <View style={styles.body}>
            <View style={styles.tagRow}>
              <View style={styles.tagPill}>
                <Text style={styles.tagText}>{quest.category}</Text>
              </View>
              <View style={styles.xpPill}>
                <Ionicons name="sparkles" size={12} color="#E5A93C" />
                <Text style={styles.xpText}>+{quest.xpReward} XP</Text>
              </View>
            </View>

            <Text style={styles.title}>{quest.title}</Text>
            {quest.description ? (
              <Text style={styles.description}>{quest.description}</Text>
            ) : null}

            {/* Offer / Access Window Banner */}
            <View style={styles.accessBanner}>
              <Ionicons name="calendar-outline" size={18} color="#A1A1AA" />
              <View style={styles.accessTextCol}>
                <Text style={styles.accessLabel}>ACCESS PERIOD</Text>
                <Text style={styles.accessValue}>
                  {quest.end_date ? `Access until ${quest.end_date}` : "Special offer window"}
                </Text>
              </View>
            </View>

            {/* Price Row */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Price</Text>
              <Text style={styles.priceValue}>₹{quest.price ?? 499}</Text>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.buyBtn}
              activeOpacity={0.88}
              onPress={handleBuyPress}
            >
              <LinearGradient
                colors={["#FFFFFF", "#FFFFFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buyGradient}
              >
                <Ionicons name="card-outline" size={18} color="#0A0A0A" />
                <Text style={styles.buyBtnText}>
                  UNLOCK QUEST (₹{quest.price ?? 499})
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.guaranteeText}>
              Purchasing grants instant access through {quest.end_date || "the offer window"}.
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.82)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    backgroundColor: "#121216",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 12,
  },
  imageContainer: {
    height: 160,
    width: "100%",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  lockBadgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: "#F59E0B",
    letterSpacing: 0.8,
  },
  body: {
    padding: 20,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tagPill: {
    backgroundColor: "#1F1F24",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: "#A1A1AA",
    letterSpacing: 0.6,
  },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(229, 169, 60, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(229, 169, 60, 0.3)",
  },
  xpText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: "#E5A93C",
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: "#FFFFFF",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  description: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: "#A1A1AA",
    lineHeight: 18,
    marginBottom: 16,
  },
  accessBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#18181D",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 16,
  },
  accessTextCol: {
    flex: 1,
  },
  accessLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    color: "#71717A",
    letterSpacing: 0.8,
  },
  accessValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: "#FFFFFF",
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#222227",
  },
  priceLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    color: "#A1A1AA",
  },
  priceValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    color: "#F59E0B",
    fontVariant: ["tabular-nums"],
  },
  buyBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  buyGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buyBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: "#0A0A0A",
    letterSpacing: 0.5,
  },
  guaranteeText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    color: "#71717A",
    textAlign: "center",
    marginTop: 12,
  },
});
