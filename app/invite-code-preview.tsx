import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Screen } from '@/components/common/Screen';
import { InviteCodeInput } from '@/components/features/invite/InviteCodeInput';
import type { ReferralLookup } from '@/services/api/referral.service';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

// Every code is "not found", so the soft inline error shows.
const lookupInvalid = async (): Promise<ReferralLookup> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { valid: false };
};

/** Developer menu preview (dev builds only): the invite code field with an invalid code. */
export default function InviteCodePreview() {
  const [code, setCode] = useState('ZZZZ9999');
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Preview: invalid code</Text>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.body}>
        <InviteCodeInput value={code} onChangeValue={setCode} lookup={lookupInvalid} initiallyExpanded persist={false} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 52,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  body: {
    padding: 16,
  },
});
