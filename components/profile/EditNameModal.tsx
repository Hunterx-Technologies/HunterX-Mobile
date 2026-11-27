import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fontFamilies } from '@/theme/typography';
import { HUNTER_NAME_MAX, HUNTER_NAME_RULE, hunterNameError } from '@/utils/textInput';

export interface EditNameModalProps {
  visible: boolean;
  initialName: string;
  onSave: (newName: string) => void;
  onClose: () => void;
}

export function EditNameModal({
  visible,
  initialName,
  onSave,
  onClose,
}: EditNameModalProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName, visible]);

  // Kept exactly as typed. A new name must be letters only; the current one
  // is fine as it is, even if it predates the rule.
  const unchanged = name.trim() === initialName.trim();
  const error = unchanged ? null : name.trim() ? hunterNameError(name) : 'Enter a username.';

  const handleSave = () => {
    const finalName = name.trim();
    if (!finalName || error) return;
    onSave(finalName);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit Display Name</Text>
          <TextInput
            style={[styles.modalInput, error && styles.modalInputError]}
            value={name}
            onChangeText={setName}
            maxLength={Math.max(HUNTER_NAME_MAX, initialName.length)}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityHint={HUNTER_NAME_RULE}
            placeholder="Enter your hunter name"
            placeholderTextColor="#71717A"
            autoFocus
          />
          <Text style={error ? styles.nameError : styles.nameHint} accessibilityRole={error ? 'alert' : undefined}>
            {error ?? HUNTER_NAME_RULE}
          </Text>
          <View style={styles.modalActionRow}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.saveBtn, !!error && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!!error || !name.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#18181C',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2E2E36',
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalInputError: {
    borderColor: '#F87171',
  },
  nameHint: {
    alignSelf: 'stretch',
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#71717A',
    marginTop: -12,
    marginBottom: 16,
  },
  nameError: {
    alignSelf: 'stretch',
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    lineHeight: 17,
    color: '#F87171',
    marginTop: -12,
    marginBottom: 16,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  cancelBtn: {
    backgroundColor: '#27272A',
  },
  cancelBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
  },
  saveBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0F12',
  },
});
