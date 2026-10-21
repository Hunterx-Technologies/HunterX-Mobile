/**
 * Sign in with Apple — hands back the identity token (plus the nonce it was
 * bound to) that our backend verifies (POST /api/auth/apple).
 *
 * iOS only: expo-apple-authentication has no Android/web implementation, and
 * the native module needs a development build (not available in Expo Go on
 * a bundle ID without the Sign in with Apple entitlement). The UI hides the
 * button wherever isAppleSignInAvailable() resolves false.
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { AppleSignInCancelledError } from './errors';

export { AppleSignInCancelledError };

export type AppleSignInResult = {
  idToken: string;
  // Apple embeds this verbatim in the token's `nonce` claim; the backend
  // checks it matches to block replayed tokens.
  nonce: string;
};

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Runs the native Sign in with Apple sheet and returns the token to send to the backend. */
export async function signInWithApple(): Promise<AppleSignInResult> {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple is only supported on iOS devices.');
  }

  if (!(await isAppleSignInAvailable())) {
    throw new Error(
      'Sign in with Apple requires a native iOS build and is not supported inside Expo Go.'
    );
  }

  const nonce = Crypto.randomUUID();

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
  } catch (err) {
    if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
      throw new AppleSignInCancelledError();
    }
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  return { idToken: credential.identityToken, nonce };
}

export function isAppleSignInCancelled(err: unknown): boolean {
  if (err instanceof AppleSignInCancelledError) return true;
  return (err as { code?: string })?.code === 'ERR_REQUEST_CANCELED';
}
