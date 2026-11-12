// Input clean-up for TextInput onChangeText, so blank-looking values (all
// spaces) and emoji can't be typed anywhere in the app. Pick the one that
// fits the field:
//
//   cleanName      names: letters and single spaces only (no digits, symbols,
//                  emoji or leading spaces)
//   cleanFreeText  messages/search: no emoji, no leading spaces or blank
//                  lines; the text itself (spacing, line breaks) is kept
//   noSpaces       emails, new passwords: no emoji, no spaces at all
//   digitsOnly     numeric codes and numbers
//
// Trailing spaces are allowed while typing (otherwise you could never type
// the space before the next word) — trim when saving.

// Emoji, written as explicit code-point ranges rather than \p{Extended_
// Pictographic}, which Hermes (the app's JS engine) doesn't fully support:
//   1F000–1FAFF  emoticons, people, animals, food, transport, flags, symbols
//   2600–27BF    misc symbols & dingbats (☀ ❤ ✅ ✈)
//   2300–23FF    misc technical (⌚ ⏰ ⏳)
//   2B00–2BFF    arrows & shapes used as emoji (⭐ ⬛)
//   3030 303D 3297 3299   〰 〽 ㊗ ㊙
//   FE0E FE0F    variation selectors   200D  zero-width joiner
//   20E3         keycap (1️⃣)           E0020–E007F  tag sequences (flags)
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{3030}\u{303D}\u{3297}\u{3299}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

/** Removes emoji (including skin tones, flags and ZWJ sequences). */
export function noEmoji(text: string): string {
  return text.replace(EMOJI, '');
}

// Anything that isn't a letter (any script, plus its combining marks — Tamil
// and Hindi vowel signs are marks) or a space. No digits in names.
const NOT_NAME_CHAR = /[^\p{L}\p{M} ]/gu;

/**
 * "  john   smith#@!99" → "john smith" (a trailing space is kept while typing).
 * Names allow only letters and single spaces — no digits, symbols or emoji.
 */
export function cleanName(text: string): string {
  return noEmoji(text)
    .replace(/\s/g, ' ')
    .replace(NOT_NAME_CHAR, '')
    .replace(/^ +/, '')
    .replace(/ {2,}/g, ' ');
}

/** Drops emoji, leading spaces and blank lines; keeps everything after them. */
export function cleanFreeText(text: string): string {
  return noEmoji(text).replace(/^\s+/, '');
}

export function noSpaces(text: string): string {
  return noEmoji(text).replace(/\s+/g, '');
}

export function digitsOnly(text: string): string {
  return text.replace(/[^0-9]/g, '');
}
