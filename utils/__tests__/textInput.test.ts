import { cleanFreeText, cleanName, digitsOnly, noEmoji, noSpaces } from '../textInput';

describe('noEmoji', () => {
  it.each([
    ['Hunter🔥', 'Hunter'],
    ['😀😃😄', ''],
    ['👍🏽 nice', ' nice'], // skin tone
    ['🇮🇳 India', ' India'], // flag
    ['👨‍👩‍👧 family', ' family'], // ZWJ sequence
    ['1️⃣ first', '1 first'], // keycap keeps the digit
    ['❤️ love ✅ done ⭐', ' love  done '],
    ['☀ sun ✈ plane ⏰', ' sun  plane '],
  ])('%j → %j', (input, expected) => {
    expect(noEmoji(input)).toBe(expected);
  });

  it('keeps ordinary letters, digits and punctuation, in any script', () => {
    const text = "Shakthi Kumar, 25 — O'Brien! Café. शक्ति தமிழ் 名前 #1 @home (ok?)";
    expect(noEmoji(text)).toBe(text);
  });
});

describe('cleanName', () => {
  it('drops emoji, leading spaces and double spaces', () => {
    expect(cleanName('   🔥John    Smith 🔥')).toBe('John Smith ');
  });
  it('an all-space or all-emoji name becomes empty', () => {
    expect(cleanName('            ')).toBe('');
    expect(cleanName('🔥🔥')).toBe('');
  });
});

describe('cleanFreeText', () => {
  it('drops emoji and leading blank lines but keeps the text as typed', () => {
    expect(cleanFreeText('\n\n   Bug  report 🐛\nline two')).toBe('Bug  report \nline two');
  });
});

describe('noSpaces / digitsOnly', () => {
  it('emails and new passwords lose spaces and emoji', () => {
    expect(noSpaces(' hunter @gmail.com😀')).toBe('hunter@gmail.com');
    expect(noSpaces('Hunter#2026 🔒')).toBe('Hunter#2026');
  });
  it('codes keep digits only', () => {
    expect(digitsOnly('12 3😀45-6')).toBe('123456');
  });
});
