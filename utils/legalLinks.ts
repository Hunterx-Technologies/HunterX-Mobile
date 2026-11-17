import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { env } from '@/config/env';

// Terms and Privacy live on the website (UAT or production, matching the
// API) and open in the in-app browser.
export const TERMS_URL = `${env.websiteUrl}/terms`;
export const PRIVACY_URL = `${env.websiteUrl}/privacy`;

export function openLegalPage(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
}
