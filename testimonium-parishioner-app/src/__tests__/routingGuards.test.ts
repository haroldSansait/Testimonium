import { getProtectedRouteGuards } from '@/services/auth/guards';

describe('protected route guards', () => {
  it('keeps auth mounted until backend bootstrap commits an authoritative state', () => {
    expect(getProtectedRouteGuards('FIREBASE_USER_PENDING_BACKEND')).toEqual({
      auth: true,
      onboarding: false,
      app: false,
    });
  });

  it('selects onboarding and ready destinations from committed auth state', () => {
    expect(getProtectedRouteGuards('EMAIL_VERIFICATION_REQUIRED')).toEqual({
      auth: false,
      onboarding: true,
      app: false,
    });
    expect(getProtectedRouteGuards('AUTHENTICATED_READY')).toEqual({
      auth: false,
      onboarding: false,
      app: true,
    });
    expect(getProtectedRouteGuards('PROFILE_COMPLETION_REQUIRED')).toEqual({
      auth: false,
      onboarding: false,
      app: true,
    });
  });
});
