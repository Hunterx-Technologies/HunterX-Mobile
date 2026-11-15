jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0', applicationId: 'com.hunterx.mobile' }));
jest.mock('@/modules/app-update', () => ({ PlayAppUpdate: null }));

import { isNewerVersion } from '../storeUpdate';

describe('isNewerVersion', () => {
  it('compares each part as a number, not as text', () => {
    expect(isNewerVersion('1.10.0', '1.9.2')).toBe(true);
    expect(isNewerVersion('1.9.2', '1.10.0')).toBe(false);
  });

  it('treats missing parts as zero', () => {
    expect(isNewerVersion('1.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.1', '1.0')).toBe(true);
  });

  it('is false for the same version', () => {
    expect(isNewerVersion('2.3.4', '2.3.4')).toBe(false);
  });
});
