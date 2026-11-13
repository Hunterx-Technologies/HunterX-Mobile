import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { extractReferralCode } from '@/services/referral/pendingReferral';
import { fontFamilies } from '@/theme/typography';

type Props = {
  /** A valid-looking code was entered: open that hunter's card. */
  onFind: (code: string) => void;
  /** The signed-in hunter's own code, so pasting it says so instead of looking it up. */
  ownCode?: string | null;
};

/**
 * "Add a friend by code": type or paste a friend's invite code (or their
 * whole invite link) and open their card, where Add friend sends a request.
 */
export function FriendCodeInput({ onFind, ownCode }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (raw = value) => {
    const code = extractReferralCode(raw);
    if (!code) {
      setError('Codes are 6 to 8 letters and numbers.');
      return;
    }
    if (ownCode && code === ownCode.toUpperCase()) {
      setError("That's your own code. Share it with a friend instead.");
      return;
    }
    setError(null);
    onFind(code);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Add a friend by code</Text>
      <View style={styles.row}>
        <View style={[styles.inputBox, error && styles.inputBoxError]}>
          <Ionicons name="person-add-outline" size={16} color="#8D98A3" />
          <TextInput
            value={value}
            onChangeText={(t) => {
              setValue(t);
              if (error) setError(null);
            }}
            placeholder="Friend's code, e.g. AX7KPQ"
            placeholderTextColor="#5B6470"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => submit()}
            style={styles.input}
            maxLength={64}
            accessibilityLabel="Friend's invite code"
          />
        </View>
        <Pressable
          onPress={() => submit()}
          disabled={!value.trim()}
          style={({ pressed }) => [styles.findBtn, !value.trim() && styles.disabled, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Find hunter"
        >
          <Text style={styles.findText}>Find</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    color: '#C9D1D9',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  inputBox: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D2530',
    backgroundColor: '#0D1115',
  },
  inputBoxError: {
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    letterSpacing: 1,
  },
  findBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#FE5B01',
    alignItems: 'center',
    justifyContent: 'center',
  },
  findText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#000000',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
  error: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    color: '#F4A5A5',
  },
});
