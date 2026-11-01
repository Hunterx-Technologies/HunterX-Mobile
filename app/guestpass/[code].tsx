import { Redirect, useLocalSearchParams } from 'expo-router';

// Older Guest Pass links (hunterx://guestpass/<code>) — same handling as
// invite links.
export default function GuestPassLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/invite/[code]', params: { code: code ?? '' } }} />;
}
