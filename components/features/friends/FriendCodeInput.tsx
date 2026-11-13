import React, { useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { fetchHunterCardByCode } from '@/services/api/friends.service';
import { extractReferralCode } from '@/services/referral/pendingReferral';
import { useFriendsStore } from '@/store/useFriendsStore';
import { showGlobalToast } from '@/store/useToastStore';
import { fontFamilies } from '@/theme/typography';
import type { HunterCard } from '@/types/friends';

type Props = {
  /** The code matched a hunter: open their card (already loaded and cached). */
  onFound: (card: HunterCard) => void;
  /** The signed-in hunter's own code, so entering it says so instead of looking it up. */
  ownCode?: string | null;
};

/**
 * "Add a friend by code": type or paste a friend's invite code (or their
 * whole invite link), then tap the search icon (or the keyboard's search
 * key). Their card opens only once it's found; anything wrong is a toast.
 */
export function FriendCodeInput({ onFound, ownCode }: Props) {
  const [value, setValue] = useState('');
  const [searching, setSearching] = useState(false);
  const rememberCard = useFriendsStore((s) => s.rememberCard);

  const search = async () => {
    if (searching || !value.trim()) return;
    const code = extractReferralCode(value);
    if (!code) {
      showGlobalToast('Codes are 6 to 8 letters and numbers.', 'error');
      return;
    }
    if (ownCode && code === ownCode.toUpperCase()) {
      showGlobalToast("That's your own code. Share it with a friend instead.", 'error');
      return;
    }
    Keyboard.dismiss();
    setSearching(true);
    try {
      const card = await fetchHunterCardByCode(code);
      rememberCard(card);
      onFound(card);
    } catch (err) {
      showGlobalToast(err instanceof Error && err.message ? err.message : 'Could not find that hunter. Please try again.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const canSearch = value.trim().length > 0 && !searching;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Add a friend by code</Text>
      <View style={styles.inputBox}>
        <Ionicons name="person-add-outline" size={16} color="#8D98A3" />
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Friend's code, e.g. AX7KPQ"
          placeholderTextColor="#5B6470"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={search}
          style={styles.input}
          maxLength={64}
          accessibilityLabel="Friend's invite code"
        />
        <Pressable
          onPress={search}
          disabled={!canSearch}
          hitSlop={10}
          style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Search for this hunter"
          accessibilityState={{ disabled: !canSearch, busy: searching }}
        >
          {searching ? (
            <ActivityIndicator size="small" color="#FE5B01" />
          ) : (
            <Ionicons name="search" size={18} color={canSearch ? '#FE5B01' : '#5B6470'} />
          )}
        </Pressable>
      </View>
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
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D2530',
    backgroundColor: '#0D1115',
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    letterSpacing: 1,
  },
  searchBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
