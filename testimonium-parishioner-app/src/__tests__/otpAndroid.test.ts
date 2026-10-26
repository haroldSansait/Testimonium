import { authApi } from '@/services/api/endpoints/auth';
import { apiClient } from '@/services/api/client';
import { createApiClient } from '@/services/api/core';
import { evaluateBootstrapState, type BackendUserProfile } from '@/types/auth';
jest.mock('@/services/api/client', () => ({ apiClient: { request: jest.fn() } }));

const profile: BackendUserProfile = { id: 1, firebaseUid: 'fixture', email: 'fixture@example.invalid', fullName: 'Fixture',
  isVerified: false, emailVerified: false, termsAccepted: true, privacyAccepted: true, needsProfileCompletion: false,
  status: 'ACTIVE', role: 'PARISHIONER' };
beforeEach(() => jest.clearAllMocks());

test.each(['request', 'verify', 'complete'])('real reset %s endpoint explicitly works without authentication', async endpoint => {
  (apiClient.request as jest.Mock).mockResolvedValue({ success: true });
  if (endpoint === 'request') await authApi.requestPasswordResetOtp(profile.email);
  else if (endpoint === 'verify') await authApi.verifyPasswordResetOtp(profile.email, '000042');
  else await authApi.completePasswordReset({ email: profile.email, resetToken: 'fixture-grant', newPassword: 'FixturePassword123' });
  expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({ path: `/auth/password-reset/${endpoint}`, auth: false }));
});
test('verification endpoint preserves code and uses authenticated transport', async () => {
  await authApi.confirmVerificationOtp('000042');
  expect(apiClient.request).toHaveBeenCalledWith(expect.objectContaining({ path: '/auth/otp/verification/confirm', body: { code: '000042' } }));
  expect((apiClient.request as jest.Mock).mock.calls[0][0].auth).not.toBe(false);
});
test('API core sends a public recovery request with null currentUser and no Authorization header', async () => {
  const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _options?: RequestInit) => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const getCurrentUser = jest.fn(() => null);
  const client = createApiClient({ getCurrentUser, getBaseUrl: () => 'https://fixture.invalid', fetchImpl: fetchImpl as typeof fetch });
  await expect(client.request({ path: '/auth/password-reset/request', method: 'POST', auth: false, body: { email: profile.email } })).resolves.toEqual({ success: true });
  expect(getCurrentUser).not.toHaveBeenCalled();
  expect(fetchImpl.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
});
test('native onboarding requires both refreshed Firebase and backend verification before legal and profile gates', () => {
  expect(evaluateBootstrapState(profile, false)).toBe('EMAIL_VERIFICATION_REQUIRED');
  expect(evaluateBootstrapState({ ...profile, emailVerified: true }, false)).toBe('EMAIL_VERIFICATION_REQUIRED');
  expect(evaluateBootstrapState({ ...profile, emailVerified: true, termsAccepted: false }, true)).toBe('LEGAL_REQUIRED');
  expect(evaluateBootstrapState({ ...profile, emailVerified: true, needsProfileCompletion: true }, true)).toBe('PROFILE_COMPLETION_REQUIRED');
  expect(evaluateBootstrapState({ ...profile, emailVerified: true }, true)).toBe('AUTHENTICATED_READY');
});
