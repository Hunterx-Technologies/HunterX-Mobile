import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { savePendingReferral } from '@/services/referral/pendingReferral';
import { colors } from '@/theme/colors';

// Target of a friend's invite link — https://<referralLinkHost>/guestpass/<code>
// (Universal/App Link) or hunterx://guestpass/<code>. Remembers the code so
// signup can attribute the new account to the inviter, then drops the user
// into the normal new-hunter flow.
export default function GuestPassLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isAuthenticated, isBootstrapping } = useAuth();
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isBootstrapping) return;
    // Referrals only apply to brand-new accounts — an already signed-in
    // hunter just lands in the app.
    if (isAuthenticated) {
      setIsSaved(true);
      return;
    }
    savePendingReferral(code).finally(() => setIsSaved(true));
  }, [code, isAuthenticated, isBootstrapping]);

  if (isBootstrapping || !isSaved) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accentGold} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return <Redirect href="/(onboarding)/name" />;
}
