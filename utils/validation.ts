// One email rule for every email field in the app (login, signup, forgot
// password, change email), so they all accept and refuse the same things.
//
// Same shape the backend checks (HunterX-Backend utils/helpers.js
// isValidEmail): something@something.something with no spaces and a single
// "@" — plus a top-level domain of at least 2 letters (like the website's
// account-deletion form) and the 254-character limit for an address.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_MAX_LENGTH = 254;

/** Trims surrounding spaces — what every email field sends to the server. */
export function cleanEmail(email: string): string {
  return email.trim();
}

export function isValidEmail(email: string): boolean {
  const value = cleanEmail(email);
  return value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
}

/** The message to show for an email field, or null when it's fine. */
export function emailError(email: string): string | null {
  if (!cleanEmail(email)) return 'Email is required.';
  if (!isValidEmail(email)) return 'Please enter a valid email address.';
  return null;
}
