import { emailError, isValidEmail } from '../validation';

describe('isValidEmail', () => {
  it.each([
    'hunter@gmail.com',
    'shakthikumar.dev@gmail.com',
    'first.last+tag@sub.example.co.in',
    'abc123@privaterelay.appleid.com',
    '  padded@example.com  ', // surrounding spaces are trimmed
  ])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    '',
    '   ',
    'plainaddress',
    'missing-at.example.com',
    'abc@',
    '@example.com',
    'abc@example',
    'abc@example.c', // top-level domain too short
    'two@@example.com',
    'a@b@example.com',
    'has space@example.com',
    'my mail a@b.co', // used to pass Signup's unanchored check
    `${'a'.repeat(250)}@x.com`, // over 254 characters
  ])('refuses %j', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('emailError', () => {
  it('asks for an email when the field is empty', () => {
    expect(emailError('  ')).toBe('Email is required.');
  });
  it('flags a malformed email', () => {
    expect(emailError('abc@')).toBe('Please enter a valid email address.');
  });
  it('is null for a valid email', () => {
    expect(emailError('hunter@gmail.com')).toBeNull();
  });
});
