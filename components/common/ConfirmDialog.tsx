import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Renders the confirm button in the danger color for destructive actions (logout, delete). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * In-app replacement for RN's Alert.alert — react-native-web ships Alert as a
 * no-op (`static alert() {}`), so anything gated behind Alert.alert silently
 * does nothing on web. Modal, unlike Alert, is fully supported there.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isStacked = confirmLabel.length > 12 || (cancelLabel && cancelLabel.length > 12);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={[styles.actions, isStacked && styles.actionsStacked]}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                isStacked && styles.buttonFull,
                pressed && styles.pressed,
              ]}
              onPress={onCancel}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
                isStacked && styles.buttonFull,
                pressed && styles.pressed,
              ]}
              onPress={onConfirm}
            >
              <Text style={destructive ? styles.destructiveLabel : styles.confirmLabel}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0D1115',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#1D2530',
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 17.5,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontFamily: fontFamilies.regular,
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionsStacked: {
    flexDirection: 'column-reverse',
    gap: 8,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonFull: {
    flex: 0,
    width: '100%',
  },
  pressed: {
    opacity: 0.85,
  },
  cancelButton: {
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#242D38',
  },
  cancelLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: '#FE5B01',
    shadowColor: '#FE5B01',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  confirmLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  destructiveButton: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  destructiveLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
