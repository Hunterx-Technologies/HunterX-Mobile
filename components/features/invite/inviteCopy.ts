/**
 * Every user-facing string in the Invite a Friend feature, in one place so
 * the wording can be checked against the Terms. Invites are attribution
 * only — never use "earn", "reward", "bonus" or "free" here.
 */
import { env } from '@/config/env';

/** https://www.hunterx.co.in/invite/<CODE> (host from EXPO_PUBLIC_REFERRAL_LINK_HOST). */
export function inviteLink(code: string): string {
  return `https://${env.referralLinkHost}/invite/${encodeURIComponent(code)}`;
}

export function shareMessage(code: string): string {
  return `Join me on HunterX! Use my code ${code}: ${inviteLink(code)}`;
}

/** Spells the code out so screen readers read it one character at a time. */
export function spokenCode(code: string): string {
  return code.split('').join(', ');
}

export const INVITE_COPY = {
  screenTitle: 'Invite Friends',
  subtext: 'Level up together on the Friends leaderboard.',
  codeLabel: 'Your invite code',
  copy: 'Copy',
  linkLabel: 'Your unique invite link',
  codeCopied: 'Code copied',
  linkCopied: 'Link copied',
  copiedShort: 'Copied!',
  linkNote: 'Only new hunters may pass through this gate',
  inviteFriends: 'Invite friends',
  shareQr: 'Share QR code',
  qrTitle: 'Scan to join',
  flipHint: 'Tap the card to flip it',
  cardA11yFront: 'Guest pass. Double-tap to show the QR code.',
  cardA11yBack: (link: string) => `QR code for ${link}. Double-tap to show the guest pass.`,
  passBadge: 'LEGENDARY GUEST PASS',
  passTitle: 'Guest Pass',
  passSubtitle: 'HUNTER INVITE',
  passCode: (code: string) => `Code : ${code}`,
  passIssuedBy: (name: string) => `ISSUED BY ${name.toUpperCase()}`,
  shareQrTitle: 'HunterX Guest Pass',
  noCode: 'Your invite code is still loading.',
  joinedCount: (n: number) =>
    n === 1 ? '1 hunter joined with your code' : `${n.toLocaleString('en-US')} hunters joined with your code`,
  offline: "You're offline. Your code still works for copying and sharing.",
  shareFailed: "Couldn't open the share sheet.",

  profileRow: 'Invite a friend',
  nudgeTitle: 'Invite a friend to hunt with you',
  nudgeAction: 'Invite',
  nudgeDismiss: 'Dismiss',

  codeFieldToggle: 'Have an invite code?',
  codeFieldPlaceholder: 'INVITE CODE',
  codeFieldPaste: 'Paste invite code',
  codeFieldPasteEmpty: 'No invite code found on your clipboard.',
  codeFieldPasteFailed: "Couldn't read the clipboard.",
  codeFieldChecking: 'Checking code…',
  codeFieldValid: (name: string) => `Invited by ${name}`,
  codeFieldInvalid: "We couldn't find that invite code. You can still sign up without it.",
  codeFieldPendingDeletion: "This invite code's account is being deleted, so it can't be used. You can still sign up.",
  codeFieldSelf: "That's your own invite code. Share it with a friend instead.",
  codeFieldUnchecked: "Couldn't check the code right now. It will still be sent when you sign up.",
  codeFieldClear: 'Remove invite code',

  linkSignedInTitle: 'You already have an account.',
  linkSignedInBody: "Invite codes are for new hunters, so this one wasn't applied.",
  linkOwnCodeTitle: "That's your own invite code.",
  linkOwnCodeBody: 'Share it with a friend so they can join you.',
  linkInvalid: "That invite link doesn't look right. You can still sign up.",
  linkContinue: 'Continue',
} as const;
