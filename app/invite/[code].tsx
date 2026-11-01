import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { INVITE_COPY } from '@/components/features/invite/inviteCopy';
import { useAuth } from '@/hooks/useAuth';
import { normalizeReferralCode, savePendingReferral } from '@/services/referral/pendingReferral';
import { showGlobalToast } from '@/store/useToastStore';
import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

// Target of a friend's invite link — https://www.hunterx.co.in/invite/<code>
// (Universal/App Link) or hunterx://invite/<code>. Signed out: keep the code
// (7 days) and start the new-hunter flow, which ends on the Register screen
// with the code prefilled — Register needs the onboarding answers first.
// Signed in: the code is ignored; invites only apply to new accounts (and
// opening your own code says so).
// The code also arrives on Android through the Play install referrer
// (services/referral/pendingReferral captureInstallReferrer).
export default function InviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isBootstrapping || isAuthenticated) return;
    if (!normalizeReferralCode(code)) {
      // Soft error — the hunter can still sign up, or type a code later.
      showGlobalToast(INVITE_COPY.linkInvalid, 'error');
      setIsSaved(true);
      return;
    }
    savePendingReferral(code).finally(() => setIsSaved(true));
  }, [code, isAuthenticated, isBootstrapping]);

  if (isBootstrapping) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accentGold} />
      </View>
    );
  }

  if (isAuthenticated) {
    const isOwnCode = !!user?.referral_code && normalizeReferralCode(code) === user.referral_code;
    return (
      <Screen style={styles.container}>
        <View style={styles.body}>
          <Text style={styles.title} accessibilityRole="header">
            {isOwnCode ? INVITE_COPY.linkOwnCodeTitle : INVITE_COPY.linkSignedInTitle}
          </Text>
          <Text style={styles.subtitle}>
            {isOwnCode ? INVITE_COPY.linkOwnCodeBody : INVITE_COPY.linkSignedInBody}
          </Text>
        </View>
        <Button label={INVITE_COPY.linkContinue} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (!isSaved) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accentGold} />
      </View>
    );
  }

  return <Redirect href="/(onboarding)/name" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
