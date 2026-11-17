import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontFamilies } from '@/theme/typography';

// Password strength, Google-style: one line of helper text under the field
// ("Use 8 or more characters with a mix of letters, numbers & symbols") and,
// once typing starts, "Password strength: Weak / Fair / Good / Strong".
// Used wherever a new password is chosen: sign-up, reset and change.

/** The rules the backend enforces on reset / change (helpers.js#isStrongPassword). */
export const PASSWORD_RULES = [
  { key: 'length', label: '8+ characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'number', label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'Symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export const meetsPasswordRules = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

const HINT = 'Use 8 or more characters with a mix of letters, numbers & symbols';

const LEVELS = [
  { label: 'Weak', color: '#EF4444' },
  { label: 'Fair', color: '#F97316' },
  { label: 'Good', color: '#EAB308' },
  { label: 'Strong', color: '#22C55E' },
] as const;

/** 0..3 → Weak..Strong: rules met 0–1 Weak, 2 Fair, 3 Good, all 4 Strong. */
function strengthIndex(p: string): number {
  const met = PASSWORD_RULES.filter((r) => r.test(p)).length;
  return Math.max(0, met - 1);
}

/** The helper line: the generic hint, or a nudge when only the uppercase rule is missing. */
function hintFor(p: string): string {
  const unmet = PASSWORD_RULES.filter((r) => !r.test(p));
  if (unmet.length === 1 && unmet[0].key === 'upper') return 'Add an uppercase letter';
  return HINT;
}

export interface PasswordStrengthMeterProps {
  password: string;
  /** Show the helper line while the rules aren't met. Defaults to true. */
  showRules?: boolean;
  /** Whether the password field has focus — the helper line only shows while it does. */
  focused?: boolean;
}

export function PasswordStrengthMeter({ password, showRules = true, focused = false }: PasswordStrengthMeterProps) {
  if (password.length === 0) {
    return showRules && focused ? (
      <View style={styles.wrap}>
        <Text style={styles.hint}>{HINT}</Text>
      </View>
    ) : null;
  }

  const level = LEVELS[strengthIndex(password)];
  const showHint = showRules && focused && !meetsPasswordRules(password);

  return (
    <View style={styles.wrap} accessibilityLabel={`Password strength: ${level.label}`}>
      <Text style={styles.strength}>
        Password strength: <Text style={[styles.level, { color: level.color }]}>{level.label}</Text>
      </Text>
      {showHint && <Text style={styles.hint}>{hintFor(password)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    marginTop: 2,
    marginBottom: 6,
  },
  strength: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    color: '#A1A1AA',
  },
  level: {
    fontFamily: fontFamilies.semiBold,
  },
  hint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 16,
    color: '#71717A',
  },
});
