import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';

import { fontFamilies } from '@/theme/typography';
import { uploadImageToCloudinary } from '@/services/media/cloudinary';
import { submitTaskProof } from '@/services/api/tasks.service';
import type { SubmitProofData } from '@/types/task';

// Photo proof for a quest that needs it (proof_count > 0). The hunter picks
// exactly `proofCount` photos; each is uploaded straight to Cloudinary
// (signed, task-proof folder), then the URLs go to POST /tasks/:id/proof.
// The quest then waits IN_REVIEW: XP and rewards come when an admin approves.

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export interface ProofSubmitModalProps {
  visible: boolean;
  questId: string;
  questTitle: string;
  xpReward: number;
  proofCount: number;
  /** The admin's reason when they asked for new photos. */
  resubmitNote?: string | null;
  onClose: () => void;
  onSubmitted: (data: SubmitProofData) => void;
}

export function ProofSubmitModal({
  visible,
  questId,
  questTitle,
  xpReward,
  proofCount,
  resubmitNote,
  onClose,
  onSubmitted,
}: ProofSubmitModalProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

  // A fresh start each time it opens for a quest.
  useEffect(() => {
    if (visible) {
      setPhotos([]);
      setError(null);
      setProgress(null);
    }
  }, [visible, questId]);

  const remaining = proofCount - photos.length;

  const pickPhotos = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: remaining > 1,
        selectionLimit: remaining,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const tooBig = result.assets.some((a) => a.fileSize && a.fileSize > MAX_PHOTO_BYTES);
      if (tooBig) setError('Each photo must be 10MB or smaller.');
      const picked = result.assets.filter((a) => !a.fileSize || a.fileSize <= MAX_PHOTO_BYTES).map((a) => a.uri);
      setPhotos((prev) => [...prev, ...picked].slice(0, proofCount));
      Haptics.selectionAsync().catch(() => {});
    } catch {
      setError('Unable to open your photos. Please try again.');
    }
  };

  const submit = async () => {
    if (photos.length !== proofCount || busy) return;
    setError(null);
    try {
      const urls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}...`);
        urls.push((await uploadImageToCloudinary(photos[i], 'task-proof')).url);
      }
      setProgress('Sending for review...');
      const data = await submitTaskProof(questId, urls);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSubmitted(data);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not send your proof. Please try again.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <Pressable style={styles.overlay} onPress={() => !busy && onClose()}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Ionicons name="camera" size={18} color="#F66F28" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>{questTitle}</Text>
              <Text style={styles.subtitle}>
                Upload {proofCount} photo{proofCount === 1 ? '' : 's'} as proof. You get +{xpReward} XP once it&apos;s approved.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={10}>
              <Ionicons name="close" size={22} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          {!!resubmitNote && (
            <View style={styles.noteBox}>
              <Ionicons name="alert-circle" size={16} color="#F59E0B" />
              <Text style={styles.noteText}>New proof needed: {resubmitNote}</Text>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>
            {Array.from({ length: proofCount }, (_, i) => {
              const uri = photos[i];
              return uri ? (
                <View key={`photo-${i}`} style={styles.slot}>
                  <Image source={{ uri }} style={styles.slotImage} contentFit="cover" />
                  {!busy && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity key={`empty-${i}`} style={[styles.slot, styles.emptySlot]} onPress={pickPhotos} disabled={busy}>
                  <Ionicons name="add" size={26} color="#71717A" />
                  <Text style={styles.slotLabel}>Photo {i + 1}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, (photos.length !== proofCount || busy) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={photos.length !== proofCount || busy}
            activeOpacity={0.85}
          >
            {busy ? <ActivityIndicator size="small" color="#0D0F12" /> : <Ionicons name="send" size={16} color="#0D0F12" />}
            <Text style={styles.submitText}>
              {progress ?? (remaining > 0 ? `Add ${remaining} more photo${remaining === 1 ? '' : 's'}` : 'Send for review')}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121316',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#26282E',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(246, 111, 40, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    fontSize: 16,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
  },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  noteText: {
    flex: 1,
    fontFamily: fontFamilies.medium,
    color: '#FCD34D',
    fontSize: 13,
    lineHeight: 18,
  },
  slots: {
    gap: 12,
  },
  slot: {
    width: 104,
    height: 104,
    borderRadius: 14,
    overflow: 'hidden',
  },
  emptySlot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#3F3F46',
    backgroundColor: '#1A1C20',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  slotLabel: {
    fontFamily: fontFamilies.medium,
    color: '#71717A',
    fontSize: 11,
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: fontFamilies.medium,
    color: '#F87171',
    fontSize: 13,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 14,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: fontFamilies.bold,
    color: '#0D0F12',
    fontSize: 15,
  },
});
