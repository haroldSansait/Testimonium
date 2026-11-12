import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { onAuthStateChanged, type User } from '@react-native-firebase/auth';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { firebaseAuth } from '@/services/firebase';
import { authApi } from '@/services/api/endpoints/auth';
import type { BackendUserProfile } from '@/types/auth';

jest.mock('@/services/api/endpoints/auth');
jest.mock('@/features/notifications/nativePush', () => ({ stopAndroidPush: jest.fn(async () => {}) }));
jest.mock('@/features/caloy/caloyStorage', () => ({ clearCaloyStorage: jest.fn(async () => {}) }));
let state: ReturnType<typeof useAuth>;
const unconfirmed: BackendUserProfile = {
  id: 1, firebaseUid: 'legal-name-fixture', email: 'fixture@example.invalid', fullName: 'Google Nickname',
  isVerified: true, emailVerified: true, termsAccepted: true, privacyAccepted: true,
  needsProfileCompletion: false, needsLegalNameConfirmation: true, role: 'PARISHIONER', status: 'ACTIVE',
};
const confirmed: BackendUserProfile = {
  ...unconfirmed, fullName: 'Juan Santos Dela Cruz', firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz',
  needsLegalNameConfirmation: false,
};
function Probe() { state = useAuth(); return null; }
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(firebaseAuth, { currentUser: {
    uid: unconfirmed.firebaseUid, email: unconfirmed.email, emailVerified: true,
    getIdToken: jest.fn(async () => 'fixture-token'),
  } as unknown as User });
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
    callback(firebaseAuth.currentUser); return jest.fn();
  });
  (authApi.profile as jest.Mock).mockResolvedValue(unconfirmed);
  (authApi.updateProfile as jest.Mock).mockResolvedValue(confirmed);
});
afterEach(async () => { await cleanup(); Object.assign(firebaseAuth, { currentUser: null }); });

test.each(['before', 'during'])('a profile refresh started %s confirmation cannot restore the old name or prompt', async timing => {
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(state.profile?.needsLegalNameConfirmation).toBe(true));
  let releaseRefresh!: (value: BackendUserProfile) => void;
  let releaseSave!: (value: BackendUserProfile) => void;
  (authApi.profile as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { releaseRefresh = resolve; }));
  (authApi.updateProfile as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { releaseSave = resolve; }));
  let refresh: Promise<BackendUserProfile | null>;
  let save: Promise<BackendUserProfile>;
  await act(async () => {
    if (timing === 'before') refresh = state.refreshProfile();
    save = state.updateProfile({ firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz', legalNameConfirmationAction: 'correct' });
    if (timing === 'during') refresh = state.refreshProfile();
  });
  await act(async () => { releaseSave(confirmed); await save; });
  await act(async () => { releaseRefresh(unconfirmed); expect(await refresh).toBeNull(); });
  expect(state.profile?.fullName).toBe(confirmed.fullName);
  expect(state.profile?.needsLegalNameConfirmation).toBe(false);
});

test('a failed confirmation preserves the unconfirmed authenticated profile', async () => {
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(state.profile?.needsLegalNameConfirmation).toBe(true));
  (authApi.updateProfile as jest.Mock).mockRejectedValueOnce(new Error('Save failed'));
  await act(async () => {
    await expect(state.updateProfile({ firstName: 'Juan', lastName: 'Cruz', legalNameConfirmationAction: 'correct' })).rejects.toBeTruthy();
  });
  expect(state.profile?.fullName).toBe(unconfirmed.fullName);
  expect(state.profile?.needsLegalNameConfirmation).toBe(true);
});
