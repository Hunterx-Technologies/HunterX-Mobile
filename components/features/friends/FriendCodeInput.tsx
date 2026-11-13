import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { extractReferralCode } from '@/services/referral/pendingReferral';
import { fontFamilies } from '@/theme/typography';

type Props = {
  /** A valid-looking code was entered: open that hunter's card. */
  onFind: (code: string) => void;
  /** The signed-in hunter's own code, so pasting it says so instead of looking it up. */
  ownCode?: string | null;
};

// Codes are 6 to 8 characters, so a 6-character prefix of an 8-character
// code is valid too: wait for a pause in typing before looking it up.
const TYPING_PAUSE_MS = 700;

/**
 * "Add a friend by code": type or paste a friend's invite code (or their
 * whole invite link) and their card opens, where Add friend sends a request.
 * No button: a paste looks it up at once, typing after a short pause, and
 * the keyboard's search key right away.
 */
export function FriendCodeInput({ onFind, ownCode }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The code last looked up, so the same text doesn't reopen the card on
  // every keystroke or pause. The search key always looks it up again.
  const lastFound = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // explicit: pasted or the search key — say what's wrong. Otherwise (a pause
  // while typing) stay quiet about text that isn't a whole code yet.
  const find = (raw: string, { explicit, force = false }: { explicit: boolean; force?: boolean }) => {
    if (!raw.trim()) return;
    const code = extractReferralCode(raw);
    if (!code) {
      if (explicit) setError('Codes are 6 to 8 letters and numbers.');
      return;
    }
    if (ownCode && code === ownCode.toUpperCase()) {
      setError("That's your own code. Share it with a friend instead.");
      return;
    }
    if (!force && code === lastFound.current) return;
    setError(null);
    lastFound.current = code;
    onFind(code);
  };

  const onChangeText = (text: string) => {
    const pasted = text.length - value.length > 1;
    setValue(text);
    if (error) setError(null);
    if (timer.current) clearTimeout(timer.current);
    if (pasted) {
      find(text, { explicit: true });
    } else {
      timer.current = setTimeout(() => find(text, { explicit: false }), TYPING_PAUSE_MS);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Add a friend by code</Text>
      <View style={[styles.inputBox, error && styles.inputBoxError]}>
        <Ionicons name="person-add-outline" size={16} color="#8D98A3" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Friend's code, e.g. AX7KPQ"
          placeholderTextColor="#5B6470"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (timer.current) clearTimeout(timer.current);
            find(value, { explicit: true, force: true });
          }}
          style={styles.input}
          maxLength={64}
          accessibilityLabel="Friend's invite code"
          accessibilityHint="Their card opens once the code is entered"
        />
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
  inputBox: {
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
  error: {
    fontFamily: fontFamilies.medium,
    fontSize: 12.5,
    color: '#F4A5A5',
  },
});
