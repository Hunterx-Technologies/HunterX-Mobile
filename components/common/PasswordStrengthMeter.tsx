import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { fontFamilies } from '@/theme/typography';

// Password strength: a 4-segment bar with Weak / Fair / Good / Strong, and —
// where the rules are enforced — the rule checklist. Used wherever a new
// password is chosen: sign-up, reset and change.

/** The rules the backend enforces on reset / change (helpers.js#isStrongPassword). */
export const PASSWORD_RULES = [
  { key: 'length', label: '8+ characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'number', label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'Symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export const meetsPasswordRules = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

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

export interface PasswordStrengthMeterProps {
  password: string;
  /** Show the 4-rule checklist (where the rules are required). Defaults to true. */
  showRules?: boolean;
}

export function PasswordStrengthMeter({ password, showRules = true }: PasswordStrengthMeterProps) {
  if (password.length === 0) return null;

  const idx = strengthIndex(password);
  const level = LEVELS[idx];

  return (
    <View style={styles.wrap} accessibilityLabel={`Password strength: ${level.label}`}>
      <View style={styles.barRow}>
        <View style={styles.bar}>
          {LEVELS.map((_, i) => (
            <View key={i} style={[styles.segment, i <= idx && { backgroundColor: level.color }]} />
          ))}
        </View>
        <Text style={[styles.levelText, { color: level.color }]}>{level.label}</Text>
      </View>

      {showRules && (
        <View style={styles.rules}>
          {PASSWORD_RULES.map((r) => {
            const met = r.test(password);
            return (
              <View key={r.key} style={styles.rule}>
                <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={met ? '#22C55E' : '#52525B'} />
                <Text style={[styles.ruleText, met && styles.ruleTextMet]}>{r.label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginTop: 2,
    marginBottom: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  levelText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    minWidth: 44,
    textAlign: 'right',
  },
  rules: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 6,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ruleText: {
    fontFamily: fontFamilies.medium,
    fontSize: 11.5,
    color: '#71717A',
  },
  ruleTextMet: {
    color: '#D4D4D8',
  },
});
