import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Feather from '@expo/vector-icons/Feather';

import { lookupReferralCode, type ReferralLookup } from '@/services/api/referral.service';
import {
  clearPendingReferral,
  extractReferralCode,
  getPendingReferral,
  normalizeReferralCode,
  savePendingReferral,
} from '@/services/referral/pendingReferral';
import { showGlobalToast } from '@/store/useToastStore';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';
import { INVITE_COPY } from './inviteCopy';

type CheckState =
  | { state: 'idle' | 'checking' | 'invalid' | 'unchecked' | 'pending_deletion' | 'self' }
  | { state: 'valid'; inviterName: string };

type InviteCodeInputProps = {
  value: string;
  onChangeValue: (code: string) => void;
  /** Swapped for a fake in the Developer menu preview. */
  lookup?: (code: string) => Promise<ReferralLookup>;
  /** Starts open (preview); otherwise opens by itself only when a code is present. */
  initiallyExpanded?: boolean;
  /** false in previews: never read or write the real pending code. */
  persist?: boolean;
};

/**
 * "Have an invite code?" — collapsed until tapped (or until a code arrives
 * from an invite link). Checks the code as it's typed and keeps it as the
 * pending code (services/referral/pendingReferral) that sign-up sends.
 * Never blocks sign-up: every problem is a soft inline note.
 */
export function InviteCodeInput({
  value,
  onChangeValue,
  lookup = lookupReferralCode,
  initiallyExpanded = false,
  persist = true,
}: InviteCodeInputProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded || value.length > 0);
  const [check, setCheck] = useState<CheckState>({ state: 'idle' });
  const [isFocused, setIsFocused] = useState(false);
  // The saved code is read before the field may write over (or clear) it.
  const [isPrefilled, setIsPrefilled] = useState(false);

  // Prefill from an invite link opened earlier, or the Play install referrer.
  useEffect(() => {
    let cancelled = false;
    if (!persist) return;
    getPendingReferral()
      .then((code) => {
        if (cancelled || !code) return;
        setExpanded(true);
        if (!value) onChangeValue(code);
      })
      .finally(() => {
        if (!cancelled) setIsPrefilled(true);
      });
    return () => {
      cancelled = true;
    };
    // Mount only — later edits belong to the hunter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const code = normalizeReferralCode(value);
    // Mirror the field into the pending code, including clearing it.
    if (persist && isPrefilled) (code ? savePendingReferral(code) : clearPendingReferral()).catch(() => {});

    if (!value || value.length < 6) {
      setCheck({ state: 'idle' });
      return;
    }
    if (!code) {
      setCheck({ state: 'invalid' });
      return;
    }
    let cancelled = false;
    setCheck({ state: 'checking' });
    const timer = setTimeout(() => {
      lookup(code)
        .then((result) => {
          if (cancelled) return;
          if (result.valid && result.inviterName) setCheck({ state: 'valid', inviterName: result.inviterName });
          else if (result.reason === 'pending_deletion') setCheck({ state: 'pending_deletion' });
          else if (result.reason === 'self') setCheck({ state: 'self' });
          else setCheck({ state: 'invalid' });
        })
        .catch(() => {
          if (!cancelled) setCheck({ state: 'unchecked' });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, lookup, persist, isPrefilled]);

  // New codes skip 0/O/1/I, but older ones (e.g. WZJE71J1) still contain
  // them, so every letter and digit is kept — same rule as the backend.
  const handleChange = (text: string) => {
    onChangeValue(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
  };

  // Never reads the clipboard on its own — only when this is tapped.
  const handlePaste = async () => {
    try {
      const code = extractReferralCode(await Clipboard.getStringAsync());
      if (code) {
        onChangeValue(code);
      } else {
        showGlobalToast(INVITE_COPY.codeFieldPasteEmpty, 'info');
      }
    } catch {
      showGlobalToast(INVITE_COPY.codeFieldPasteFailed, 'info');
    }
  };

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={INVITE_COPY.codeFieldToggle}
        accessibilityState={{ expanded: false }}
        style={styles.toggle}
      >
        <Feather name="user-plus" size={16} color={colors.accentOrange} />
        <Text style={styles.toggleText}>{INVITE_COPY.codeFieldToggle}</Text>
        <Feather name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
    );
  }

  const note = noteFor(check);
  const noteColor =
    check.state === 'valid' ? colors.success : check.state === 'checking' ? colors.textMuted : colors.textSecondary;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{INVITE_COPY.codeFieldToggle}</Text>
      <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
        <Feather
          name="user-plus"
          size={18}
          color={isFocused ? colors.accentOrange : colors.textMuted}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={INVITE_COPY.codeFieldPlaceholder}
          placeholderTextColor="#52525B"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={8}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={INVITE_COPY.codeFieldToggle}
          accessibilityHint="6 to 8 letters and numbers"
        />
        {check.state === 'checking' ? <ActivityIndicator size="small" color={colors.accentOrange} /> : null}
        {value ? (
          <Pressable
            onPress={() => onChangeValue('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={INVITE_COPY.codeFieldClear}
            style={styles.iconBtn}
          >
            <Feather name="x" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Pressable onPress={handlePaste} hitSlop={10} accessibilityRole="button" style={styles.iconBtn}>
            <Text style={styles.pasteText}>{INVITE_COPY.codeFieldPaste}</Text>
          </Pressable>
        )}
      </View>
      {note ? (
        <Text style={[styles.note, { color: noteColor }]} accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function noteFor(check: CheckState): string | null {
  switch (check.state) {
    case 'checking':
      return INVITE_COPY.codeFieldChecking;
    case 'valid':
      return INVITE_COPY.codeFieldValid(check.inviterName);
    case 'invalid':
      return INVITE_COPY.codeFieldInvalid;
    case 'pending_deletion':
      return INVITE_COPY.codeFieldPendingDeletion;
    case 'self':
      return INVITE_COPY.codeFieldSelf;
    case 'unchecked':
      return INVITE_COPY.codeFieldUnchecked;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 44,
  },
  toggleText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  container: {
    gap: 8,
  },
  label: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D0D0F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputWrapperFocused: {
    borderColor: colors.accentOrange,
  },
  inputIcon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  iconBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  pasteText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: colors.accentOrange,
  },
  note: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 4,
  },
});
