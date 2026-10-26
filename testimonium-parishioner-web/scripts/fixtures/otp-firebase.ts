// @ts-nocheck
// Firebase and HTTP boundaries only; the production AuthContext, SessionService,
// route guard and pages run unchanged in the browser.
const listeners = new Set();
export const auth = { currentUser: null };
const fixture = window.fixture = { calls: [], reloads: 0, freshTokens: 0, verified: false, rejectCode: false, holdConfirm: false,
  release: null, email: 'owner@example.invalid', uid: 'fixture-owner', registered: true };
const profile = () => ({ id: 1, firebaseUid: fixture.uid, email: fixture.email, fullName: 'Fixture Owner', role: 'PARISHIONER',
  isVerified: fixture.verified, emailVerified: fixture.verified, status: 'ACTIVE', termsAccepted: fixture.legalAccepted !== false, privacyAccepted: fixture.legalAccepted !== false,
  needsProfileCompletion: false });
const makeUser = () => ({ uid: fixture.uid, email: fixture.email, emailVerified: fixture.verified,
  providerData: [{ providerId: 'password' }],
  async getIdToken(force) { if(force) fixture.freshTokens++; return 'fixture-token'; },
  async reload() { fixture.reloads++; this.emailVerified=fixture.verified; this.email=fixture.email; },
});
fixture.session = async (verified=false, uid='fixture-owner', email='owner@example.invalid') => {
  Object.assign(fixture,{verified,uid,email}); auth.currentUser=makeUser();
  sessionStorage.setItem("otp-fixture-session",JSON.stringify({verified,uid,email}));
  for (const listener of listeners) await listener(auth.currentUser);
};
fixture.out = async () => {sessionStorage.removeItem("otp-fixture-session"); auth.currentUser=null; for(const listener of listeners) await listener(null);};
fixture.profile = profile;
export const onAuthStateChanged = (_auth, callback) => { listeners.add(callback); queueMicrotask(()=>callback(auth.currentUser)); return ()=>listeners.delete(callback); };
export const signInWithEmailAndPassword = async (_auth,email) => { await fixture.session(false,'fixture-owner',email); return {user:auth.currentUser}; };
export const createUserWithEmailAndPassword = async (_auth,email) => { fixture.registered=false; await fixture.session(false,'fixture-owner',email); return {user:auth.currentUser}; };
export const updateProfile = async (user,data) => Object.assign(user,data);
export const signOut = async () => fixture.out();
export const setPersistence = async () => {};
export const browserLocalPersistence = {};
export const browserSessionPersistence = {};
export class GoogleAuthProvider { setCustomParameters(){} }
export const signInWithPopup = async () => { await fixture.session(true); auth.currentUser.providerData=[{providerId:'google.com'}]; return {user:auth.currentUser}; };
export const EmailAuthProvider = { credential: (email,password) => ({email,password}) };
export const reauthenticateWithCredential = async () => { fixture.reauthenticated=true; };
export const updateEmail = async (user,email) => { fixture.email=email; fixture.verified=false; user.email=email; user.emailVerified=false; };
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
window.fetch = async (url,options={}) => {
  const path = new URL(url,location.origin).pathname;
  const body = options.body ? JSON.parse(options.body) : {};
  fixture.calls.push({path,body});
  if(path.endsWith('/auth/profile')) {
    const snapshot=profile();
    if(fixture.holdNextProfile) { fixture.holdNextProfile=false; await new Promise(resolve=>fixture.releaseProfile=resolve); }
    return json({success:true,data:snapshot});
  }
  if(path.endsWith('/auth/login')) return fixture.verified ? json({success:true,data:{user:profile()}}) : json({success:false,code:'EMAIL_NOT_VERIFIED',message:'Please verify your email before signing in.'},403);
  if(path.endsWith('/auth/register')) {fixture.registered=true; return json({success:true,data:profile()});}
  if(path.endsWith('/auth/otp/verification/request')) return fixture.verificationError ? json({success:false,...fixture.verificationError},429) : json({success:true,retryAfter:60});
  if(path.endsWith('/auth/otp/verification/confirm')) {
    if(fixture.holdConfirm) await new Promise(resolve=>fixture.release=resolve);
    if(fixture.rejectCode || body.code !== '000042') return json({success:false,code:'OTP_INVALID',message:'Invalid or expired code.'},400);
    fixture.verified=true; return json({success:true,data:profile()});
  }
  if(path.endsWith('/auth/password-reset/request')) return json({success:true,cooldownSeconds:60});
  if(path.endsWith('/auth/password-reset/verify')) return body.code==='000042' ? json({success:true,resetToken:'fixture-grant'}) : json({success:false,message:'Invalid or expired code.'},400);
  if(path.endsWith('/auth/password-reset/complete')) return fixture.resetExpired ? json({success:false,message:'Reset session expired. Request a fresh code.'},400) : body.newPassword.length>=8 ? json({success:true}) : json({success:false,message:'Weak password.'},400);
  if(path.includes('/legal')) return json({success:true,data:{termsOfService:{policyType:'TERMS_OF_SERVICE',revision:1,version:'v1.0',content:'Fixture terms',effectiveAt:'2026-01-01'},privacyPolicy:{policyType:'PRIVACY_POLICY',revision:1,version:'v1.0',content:'Fixture privacy',effectiveAt:'2026-01-01'}}});
  return json({success:true,data:[]});
};

const restored = JSON.parse(sessionStorage.getItem("otp-fixture-session") || "null");
if(restored) { Object.assign(fixture,restored); auth.currentUser=makeUser(); }
