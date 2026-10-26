import React from 'react';
import { render, waitFor, act, cleanup } from '@testing-library/react-native';
import { onAuthStateChanged, reload, getIdToken, type User } from '@react-native-firebase/auth';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { firebaseAuth } from '@/services/firebase';
import { authApi } from '@/services/api/endpoints/auth';
import type { BackendUserProfile } from '@/types/auth';
jest.mock('@/services/api/endpoints/auth');
jest.mock('@/features/notifications/nativePush',()=>({stopAndroidPush:jest.fn(async()=>{})}));
jest.mock('@/features/caloy/caloyStorage',()=>({clearCaloyStorage:jest.fn(async()=>{})}));
let state: ReturnType<typeof useAuth>;
let observer: (user: User|null)=>void;
const profile=(uid='fixture-owner'):BackendUserProfile=>({id:1,firebaseUid:uid,email:`${uid}@example.invalid`,fullName:'Fixture Owner',
  isVerified:false,emailVerified:false,termsAccepted:true,privacyAccepted:true,needsProfileCompletion:false,status:'ACTIVE',role:'PARISHIONER'});
const user=(uid='fixture-owner')=>({uid,email:`${uid}@example.invalid`,emailVerified:false,getIdToken:jest.fn(async()=> 'fixture-token')}) as unknown as User;
function Probe(){state=useAuth();return null;}
beforeEach(()=>{
  jest.clearAllMocks();
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth,callback)=>{observer=callback;callback(firebaseAuth.currentUser);return jest.fn();});
  (authApi.profile as jest.Mock).mockImplementation(async()=>profile(firebaseAuth.currentUser?.uid));
  (reload as jest.Mock).mockImplementation(async current=>{current.emailVerified=true;});
  (getIdToken as jest.Mock).mockResolvedValue('fixture-fresh-token');
  Object.assign(firebaseAuth,{currentUser:user()});
});
afterEach(async()=>{await cleanup();Object.assign(firebaseAuth,{currentUser:null});});

test('actual native provider reloads Firebase and fresh token, then commits the verified backend profile',async()=>{
  await render(<AuthProvider><Probe/></AuthProvider>);
  await waitFor(()=>expect(state.state).toBe('EMAIL_VERIFICATION_REQUIRED'));
  (authApi.confirmVerificationOtp as jest.Mock).mockResolvedValue(profile());
  (authApi.profile as jest.Mock).mockResolvedValue({...profile(),isVerified:true,emailVerified:true});
  let result=false;await act(async()=>{result=await state.confirmEmailVerificationOtp('000042');});
  expect(result).toBe(true);expect(reload).toHaveBeenCalledTimes(1);expect(getIdToken).toHaveBeenCalledWith(firebaseAuth.currentUser,true);
  expect(state.state).toBe('AUTHENTICATED_READY');
});
test('actual provider rejects a stale OTP response after account switching',async()=>{
  await render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(state.state).toBe('EMAIL_VERIFICATION_REQUIRED'));
  let release:()=>void=()=>{};
  (authApi.confirmVerificationOtp as jest.Mock).mockImplementation(()=>new Promise<void>(resolve=>{release=resolve;}));
  const pending=state.confirmEmailVerificationOtp('000042');
  await act(async()=>{Object.assign(firebaseAuth,{currentUser:user('different-owner')});observer(firebaseAuth.currentUser);});
  release();expect(await pending).toBe(false);expect(reload).not.toHaveBeenCalled();
  await waitFor(()=>expect(state.profile?.firebaseUid).toBe('different-owner'));
});
test('actual provider does not report successful verification if backend state is still unverified',async()=>{
  await render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(state.state).toBe('EMAIL_VERIFICATION_REQUIRED'));
  (authApi.confirmVerificationOtp as jest.Mock).mockResolvedValue(profile());
  let result=true;await act(async()=>{result=await state.confirmEmailVerificationOtp('000042');});
  expect(result).toBe(false);expect(state.state).toBe('EMAIL_VERIFICATION_REQUIRED');
});

test('a background profile response from before confirmation cannot undo verified native state',async()=>{
  await render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(state.state).toBe('EMAIL_VERIFICATION_REQUIRED'));
  let release:(value:BackendUserProfile)=>void=()=>{};
  (authApi.profile as jest.Mock).mockImplementationOnce(()=>new Promise<BackendUserProfile>(resolve=>{release=resolve;}));
  const pending=state.refreshProfile();
  (authApi.confirmVerificationOtp as jest.Mock).mockResolvedValue(profile());
  (authApi.profile as jest.Mock).mockResolvedValue({...profile(),isVerified:true,emailVerified:true});
  await act(async()=>{await state.confirmEmailVerificationOtp('000042');release(profile());await pending;});
  expect(state.state).toBe('AUTHENTICATED_READY');expect(state.profile?.emailVerified).toBe(true);
});
test('already-verified resend reconciles Firebase/profile after an interrupted confirmation without claiming a new send',async()=>{
  await render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(state.state).toBe('EMAIL_VERIFICATION_REQUIRED'));
  (authApi.requestVerificationOtp as jest.Mock).mockResolvedValue({success:true,alreadyVerified:true,message:'Email is already verified.'});
  (authApi.profile as jest.Mock).mockResolvedValue({...profile(),isVerified:true,emailVerified:true});
  await act(async()=>{const result=await state.resendVerification();expect(result.message).toBe('Email is already verified.');});
  expect(state.state).toBe('AUTHENTICATED_READY');expect(getIdToken).toHaveBeenCalledWith(firebaseAuth.currentUser,true);
});
