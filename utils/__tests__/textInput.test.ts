import { cleanFreeText, cleanName, digitsOnly, hunterNameError, HUNTER_NAME_ERROR, HUNTER_NAME_RULE, isValidHunterName, noEmoji, noSpaces } from '../textInput';

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
  it('drops special characters', () => {
    expect(cleanName('#(*&@#(!@&#(@!&*#(')).toBe('');
    expect(cleanName("Shadow_Hunter#99! O'Brien-Lee.")).toBe('ShadowHunter OBrienLee');
    expect(cleanName('₹€$ John © ™')).toBe('John ');
  });
  it('a name made only of symbols and spaces becomes empty', () => {
    expect(cleanName('  @@  ##  ')).toBe('');
  });
  it('keeps letters in any script, including combining marks', () => {
    expect(cleanName('शक्ति தமிழ் 名前 Café')).toBe('शक्ति தமிழ் 名前 Café');
  });
  it('drops digits, in any script', () => {
    expect(cleanName('Hunter123')).toBe('Hunter');
    expect(cleanName('12345')).toBe('');
    expect(cleanName('Raj ٣٤ ४५ Kumar')).toBe('Raj Kumar');
  });
  it('turns tabs and newlines into single spaces', () => {
    expect(cleanName('John\t\nSmith')).toBe('John Smith');
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

describe('hunterNameError (the hunter name rule: English letters only, never cleaned up)', () => {
  it.each(['Shadow', 'hunter', 'ABC', 'a', '  Shadow  '])('accepts %j', (name) => {
    expect(hunterNameError(name)).toBeNull();
    expect(isValidHunterName(name)).toBe(true);
  });
  it.each(['hxtest01', 'hx_test', 'John Smith', 'hunter!', "O'Neil", 'Zoë', 'தமிழ்', 'hunter😀', 'a-b', '123'])('rejects %j with the letters-only message', (name) => {
    expect(hunterNameError(name)).toBe(HUNTER_NAME_ERROR);
    expect(isValidHunterName(name)).toBe(false);
  });
  it('empty is not an error yet, but not saveable either', () => {
    expect(hunterNameError('   ')).toBeNull();
    expect(isValidHunterName('   ')).toBe(false);
  });
  it('more than 24 letters is rejected', () => {
    expect(hunterNameError('a'.repeat(25))).toMatch(/at most 24/);
  });
  it('shows the rule text the spec asks for', () => {
    expect(HUNTER_NAME_RULE).toBe('Username can contain letters only. Numbers, spaces and special characters are not allowed.');
    expect(HUNTER_NAME_ERROR).toBe('Please use letters only for your username.');
  });
});
