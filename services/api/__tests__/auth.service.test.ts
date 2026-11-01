import * as auth from '../auth.service';
import { apiClient } from '../client';
import { tokenStorage } from '../tokenStorage';

jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(() => Promise.resolve(true)) } }));
jest.mock('../client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  refreshAccessToken: jest.fn(),
}));
jest.mock('../tokenStorage', () => ({
  tokenStorage: {
    getRefreshToken: jest.fn(async () => 'refresh-1'),
    setTokens: jest.fn(async () => {}),
    clearTokens: jest.fn(async () => {}),
  },
}));

const post = apiClient.post as jest.Mock;
const patch = apiClient.patch as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('auth.service', () => {
  it('logout revokes the session on the server, then clears the device', async () => {
    post.mockResolvedValue({ data: { success: true } });
    await auth.logout();
    expect(post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-1' }, expect.anything());
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
  });

  it('logout still clears the device when offline', async () => {
    post.mockRejectedValue(new Error('Network Error'));
    await auth.logout();
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
  });

  it('verifyOtp has no offline or test-code bypass', async () => {
    post.mockRejectedValue(new Error('Network Error'));
    await expect(auth.verifyOtp('a@example.com', '123456')).rejects.toThrow('Network Error');
  });

  it('sendOtp reports a network failure instead of pretending it sent', async () => {
    post.mockRejectedValue(new Error('Network Error'));
    await expect(auth.sendOtp('a@example.com')).rejects.toThrow('Network Error');
  });

  it('signup never signs in without tokens', async () => {
    post.mockRejectedValue(Object.assign(new Error('Not found'), { response: { status: 404, data: { success: false, message: 'Route not found' } } }));
    await expect(auth.signup({ name: 'H', email: 'a@example.com', password: 'Hunter#2026', onboarding: [] })).rejects.toThrow('Route not found');
    expect(tokenStorage.setTokens).not.toHaveBeenCalled();
  });

  it('turns password-rule errors into a readable message', async () => {
    post.mockRejectedValue(Object.assign(new Error('Bad request'), {
      response: { status: 400, data: { success: false, errors: ['ONE_NUMBER', 'ONE_SPECIAL_CHARACTER'] } },
    }));
    await expect(auth.resetPassword('t', 'Password', 'Password')).rejects.toThrow('Password needs a number, a special character.');
  });

  it('email change sends the password first, then the code', async () => {
    patch.mockResolvedValueOnce({ data: { success: true, message: 'We sent a 6-digit code to new@example.com.' } });
    await expect(auth.requestEmailChange(' new@example.com ', 'pw')).resolves.toMatch(/6-digit code/);
    expect(patch).toHaveBeenLastCalledWith('/users/me/email', { email: 'new@example.com', currentPassword: 'pw' });

    patch.mockResolvedValueOnce({ data: { success: true, data: { user: { id: 1, email: 'new@example.com' } } } });
    const user = await auth.confirmEmailChange('new@example.com', '123456');
    expect(patch).toHaveBeenLastCalledWith('/users/me/email', { email: 'new@example.com', otp: '123456' });
    expect(user.email).toBe('new@example.com');
  });
});
