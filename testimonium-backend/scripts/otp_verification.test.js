import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fixture } from './helpers/otp-fixture.js';
Object.assign(process.env, { NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: 'postgresql://test:test@127.0.0.1:9/test',
  SUPABASE_DATABASE_URL: 'postgresql://test:test@127.0.0.1:9/test', OTP_HMAC_SECRET: 'deterministic-test-secret-32-bytes-minimum' });
const { OtpService, generateOtpCode, hashOtpCode, verifyOtpCode, generateResetToken, hashResetToken, verifyResetToken } = await import('../services/OtpService.js');
const { renderEmail } = await import('../services/email/EmailTemplates.js');
const make = () => fixture(OtpService);

test('six digits preserve leading zeros using crypto.randomInt', t => {
  t.mock.method(crypto, 'randomInt', () => 42);
  assert.equal(generateOtpCode(), '000042');
});
test('HMAC binds normalized email, purpose, UID and random challenge binding', () => {
  const hash = hashOtpCode('000042', ' Owner@EXAMPLE.invalid ', 'EMAIL_VERIFICATION', 'uid:salt');
  assert.equal(verifyOtpCode('000042', 'owner@example.invalid', 'EMAIL_VERIFICATION', hash, 'uid:salt'), true);
  for (const [email, purpose, binding] of [['other@example.invalid', 'EMAIL_VERIFICATION', 'uid:salt'], ['owner@example.invalid','PASSWORD_RESET','uid:salt'], ['owner@example.invalid','EMAIL_VERIFICATION','other:salt']]) {
    assert.equal(verifyOtpCode('000042', email, purpose, hash, binding), false);
  }
  assert.equal(verifyOtpCode(42, 'owner@example.invalid', 'EMAIL_VERIFICATION', hash), false);
});
test('256-bit reset grant hashes bind email and reject malformed comparisons', () => {
  const token = generateResetToken(); assert.match(token, /^[a-f0-9]{64}$/);
  const hash = hashResetToken(token, 'owner@example.invalid');
  assert.equal(verifyResetToken(token, 'owner@example.invalid', hash), true);
  assert.equal(verifyResetToken(token, 'other@example.invalid', hash), false);
  assert.equal(verifyResetToken(token, 'owner@example.invalid', 'bad'), false);
});
test('both purpose-specific emails escape HTML, include selectable code, text, clean branding with NO image tags, attachments, or CID', async () => {
  const MailComposer = (await import('nodemailer/lib/mail-composer/index.js')).default;
  for (const purpose of ['EMAIL_VERIFICATION', 'PASSWORD_RESET']) {
    const mail = renderEmail(`${purpose}_OTP`, { code: '000042', recipientName: '<script>"Owner"</script>' });
    assert.match(mail.html, /&lt;script&gt;/); assert.doesNotMatch(mail.html, /<script>/);
    assert.match(mail.html, /expires in 10 minutes/); assert.match(mail.text, /000042/);
    assert.doesNotMatch(mail.html, /<img\b/i);
    assert.doesNotMatch(mail.html, /cid:/i);
    assert.equal(mail.attachments, undefined);
    assert.match(mail.html, /TESTIMONIUM/);
    assert.match(mail.html, /Diocese of San Carlos/);
    assert.match(mail.html, /width="540"/);
    assert.doesNotMatch(mail.html, /onclick|clipboard|https?:[^" ]*000042/);

    // Verify MailComposer generates pure multipart/alternative MIME with NO attachments, images, or multipart/related
    const mime = await new MailComposer({
      from: 'testimonium.system@gmail.com',
      to: 'parishioner@example.invalid',
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.attachments ? { attachments: mail.attachments } : {}),
    }).compile().build();
    const mimeStr = mime.toString();
    assert.match(mimeStr, /Content-Type:\s*multipart\/alternative/i);
    assert.doesNotMatch(mimeStr, /Content-Type:\s*multipart\/related/i);
    assert.doesNotMatch(mimeStr, /Content-Disposition:\s*attachment/i);
    assert.doesNotMatch(mimeStr, /Content-ID:/i);
    assert.doesNotMatch(mimeStr, /cid:/i);
    assert.doesNotMatch(mimeStr, /<img\b/i);
  }
});

test('send reserves challenge before transport and stores no raw OTP', async () => {
  const f=make(); let observed;
  f.delivery.send = async mail => { observed = structuredClone(f.rows[0]); f.mails.push(mail); };
  await f.request(); assert.equal(observed.status, 'SENDING'); assert.equal(f.rows[0].status, 'PENDING');
  assert.equal(JSON.stringify(f.rows).includes(f.code()), false); assert.equal(f.rows[0].expiresAt - f.rows[0].createdAt, 600_000);
});
test('simultaneous resends reserve and deliver exactly one code', async () => {
  const f=make(); const results=await Promise.allSettled(Array.from({length:12},()=>f.request()));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1); assert.equal(f.mails.length,1); assert.equal(f.rows.length,1);
});
test('cooldown and rolling 24h cap survive terminal challenges', async () => {
  const f=make(); await f.request(); await assert.rejects(f.request(),{code:'RESEND_COOLDOWN_ACTIVE'});
  const { getOtpMaxDailySends } = await import('../config/env.js');
  const limit = getOtpMaxDailySends();
  for(let n=1;n<limit;n++){ f.age(); await f.request(); }
  f.age();
  await assert.rejects(f.request(), (err) => {
    assert.equal(err.code, 'ACCOUNT_RESEND_LIMIT_EXCEEDED');
    assert.equal(err.statusCode, 429);
    assert.ok(err.retryAfter > 0);
    assert.match(err.message, new RegExp(`limit \\(${limit} requests\\)`));
    return true;
  });
  f.rows.forEach(r=>{r.createdAt=new Date(Date.now()-86_400_001);}); await f.request(); assert.equal(f.mails.length,limit+1);
});
test('changing email cannot evade UID send quota and invalidates old challenges', async () => {
  const f=make(); await f.request(); f.age(); f.users.get('uid-1').email='new@example.invalid';
  await f.service.requestEmailVerificationOtp({...f.identity,email:'new@example.invalid'});
  assert.equal(f.rows[0].status,'INVALIDATED'); assert.equal(f.rows[1].status,'PENDING');
});
test('resending invalidates the previous code and changes its challenge hash even if the number repeats', async t => {
  t.mock.method(crypto,'randomInt',()=>42); const f=make(); await f.request(); const first=f.rows[0].codeHash;
  f.age(); await f.request(); assert.equal(f.rows[0].status,'INVALIDATED'); assert.notEqual(f.rows[1].codeHash,first);
});
test('delivery failure invalidates reservation and never reports sent', async () => {
  const f=make(); f.delivery.send=async()=>{throw new Error('private raw code/provider credential');};
  await assert.rejects(f.request(),{code:'EMAIL_DELIVERY_FAILED'}); assert.equal(f.rows[0].status,'INVALIDATED');
});
test('already verified including Google accounts send no challenge', async () => {
  const f=make(); f.users.get('uid-1').emailVerified=true; f.users.get('uid-1').providerData=[{providerId:'google.com'}];
  assert.equal((await f.request()).alreadyVerified,true); assert.equal(f.rows.length,0);
});
test('stale token email cannot request or confirm a challenge for the new Firebase email', async () => {
  const f=make(); await f.request(); f.users.get('uid-1').email='changed@example.invalid';
  await assert.rejects(f.confirm(),{code:'IDENTITY_CHANGED'}); await assert.rejects(f.request(),{code:'IDENTITY_CHANGED'});
  assert.equal(f.calls.verifications.length,0);
});
test('20 concurrent wrong guesses persist exactly five attempts and cannot resurrect a failed code', async () => {
  const f=make(); await f.request(); const wrong=f.code()==='999999'?'888888':'999999';
  const results=await Promise.allSettled(Array.from({length:20},()=>f.confirm(wrong)));
  assert.equal(results.every(r=>r.status==='rejected'),true); assert.equal(f.rows[0].attempts,5); assert.equal(f.rows[0].status,'FAILED');
  await assert.rejects(f.confirm(),{code:'OTP_INVALID'});
});
test('exact expiry persists EXPIRED and disallows a correct code', async () => {
  const f=make(); await f.request(); f.rows[0].expiresAt=new Date(Date.now()-1);
  await assert.rejects(f.confirm(),{code:'OTP_INVALID'}); assert.equal(f.rows[0].status,'EXPIRED');
});
test('two correct confirmations produce one Firebase write and UID-only database synchronization', async () => {
  const f=make(); await f.request(); const results=await Promise.allSettled([f.confirm(),f.confirm()]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1); assert.deepEqual(f.calls.verifications,['uid-1']);
  assert.deepEqual(f.writes.find(w=>w.data?.isVerified)?.where,{firebaseUid:'uid-1'});
});
test('Firebase verification failure rolls back consumption and can retry the same code', async () => {
  const f=make(); await f.request(); const good=f.firebase.setEmailVerified;
  f.firebase.setEmailVerified=async()=>{throw new Error('provider failed');};
  await assert.rejects(f.confirm(),{code:'VERIFICATION_UNAVAILABLE'}); assert.equal(f.rows[0].status,'PENDING');
  assert.equal(f.writes.some(w=>w.data?.isVerified),false); f.firebase.setEmailVerified=good; await f.confirm();
});
test('password request acknowledgement precedes eligibility/provider work for all accounts', async () => {
  const f=make(); let calls=0; f.firebase.getUserByEmail=async()=>{calls++;return null;};
  const a=await f.service.requestPasswordResetOtp(f.identity);
  const b=await f.service.requestPasswordResetOtp({email:'absent@example.invalid'});
  assert.deepEqual(a,b); assert.equal(calls,0); await Promise.all([...f.service.dispatches]); assert.equal(calls,2);
});
test('Google-only, disabled and missing accounts never receive reset codes', async () => {
  for(const account of [null,{disabled:true},{providerData:[{providerId:'google.com'}]},{providerData:[]}]) {
    const f=make(); if(!account) f.users.clear(); else Object.assign(f.users.get('uid-1'),account);
    await f.requestReset(); assert.equal(f.rows.length,0); assert.equal(f.mails.length,0);
  }
});
test('reset request hides cooldown and delivery failure behind the same generic acknowledgement', async () => {
  const f=make(); const a=await f.requestReset(); const b=await f.requestReset(); assert.deepEqual(a,b); assert.equal(f.mails.length,1);
  f.age(); f.delivery.send=async()=>{throw new Error('failure');}; const c=await f.requestReset(); assert.deepEqual(a,c); assert.equal(f.rows.at(-1).status,'INVALIDATED');
});
test('reset OTP is purpose isolated, single use, and concurrent verification issues one grant', async () => {
  const f=make(); await f.requestReset(); await assert.rejects(f.confirm(),{code:'OTP_INVALID'});
  const results=await Promise.allSettled([0,1].map(()=>f.service.verifyPasswordResetOtp({email:f.identity.email,code:f.code()})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1); assert.equal(f.rows[0].status,'VERIFIED');
  assert.equal(JSON.stringify(f.rows).includes(results.find(r=>r.status==='fulfilled').value.resetToken),false);
});
test('unknown, wrong, expired and exhausted reset codes have identical public errors', async () => {
  const f=make(); const get=async email=>{try{await f.service.verifyPasswordResetOtp({email,code:'999999'});}catch(e){return {code:e.code,status:e.statusCode,message:e.message};}};
  const absent=await get('absent@example.invalid'); await f.requestReset();
  if(f.code()==='999999') f.rows[0].codeHash='f'.repeat(64);
  assert.deepEqual(await get(f.identity.email),absent); f.rows[0].expiresAt=new Date(0); assert.deepEqual(await get(f.identity.email),absent);
});
test('grant is bound to current UID/email; no email fallback after identity deletion or change', async () => {
  for(const changed of ['deleted','changed']) { const f=make(); const {resetToken}=await f.grant();
    if(changed==='deleted')f.users.clear(); else f.users.get('uid-1').email='other@example.invalid';
    await assert.rejects(f.reset(resetToken)); assert.equal(f.calls.passwords.length,0);
  }
});
test('grant expiry and server password validation precede external side effects', async () => {
  const f=make(); const {resetToken}=await f.grant();
  await assert.rejects(f.service.completePasswordReset({email:f.identity.email,resetToken,newPassword:'short'}),{code:'WEAK_PASSWORD'});
  f.rows[0].resetTokenExpiresAt=new Date(0); await assert.rejects(f.reset(resetToken),{code:'RESET_GRANT_INVALID'}); assert.equal(f.calls.passwords.length,0);
});
test('simultaneous reset completion authorizes one password write and one revocation', async () => {
  const f=make(); const {resetToken}=await f.grant(); const results=await Promise.allSettled([f.reset(resetToken),f.reset(resetToken)]);
  assert.ok(results.some(r=>r.status==='fulfilled')); assert.equal(f.calls.passwords.length,1); assert.equal(f.calls.revocations.length,1);
  await f.reset(resetToken); assert.equal(f.calls.passwords.length,1);
  await assert.rejects(f.service.completePasswordReset({email:f.identity.email,resetToken,newPassword:'DifferentPassword123!'}),{code:'RESET_GRANT_INVALID'});
});
test('revocation failure retries cleanup without replaying the password change', async () => {
  const f=make(); const {resetToken}=await f.grant(); const revoke=f.firebase.revokeRefreshTokens;
  f.firebase.revokeRefreshTokens=async()=>{throw new Error('unavailable');}; await assert.rejects(f.reset(resetToken),{code:'RESET_REVOCATION_PENDING'});
  assert.equal(f.rows[0].operationStage,'APPLIED'); f.releaseLease(); f.firebase.revokeRefreshTokens=revoke; await f.reset(resetToken);
  assert.equal(f.calls.passwords.length,1); assert.equal(f.rows[0].operationStage,'COMPLETED');
});
test('Firebase success then failed stage write never permits a second password change', async () => {
  const f=make(); const {resetToken}=await f.grant(); f.prisma.failStage='APPLIED';
  await assert.rejects(f.reset(resetToken)); assert.equal(f.rows[0].operationStage,'APPLYING'); f.releaseLease();
  await assert.rejects(f.reset(resetToken),{code:'RESET_OUTCOME_UNKNOWN'}); assert.equal(f.calls.passwords.length,1); assert.equal(f.calls.revocations.length,2);
});
test('completion database failure preserves APPLIED so a lost response reconciles successfully', async () => {
  const f=make(); const {resetToken}=await f.grant(); f.prisma.failStage='COMPLETED'; await assert.rejects(f.reset(resetToken));
  f.releaseLease(); await f.reset(resetToken); assert.equal(f.calls.passwords.length,1); assert.equal(f.rows[0].operationStage,'COMPLETED');
});
test('ambiguous Firebase timeout revokes sessions and requires a fresh code, never replays update', async () => {
  const f=make(); const {resetToken}=await f.grant(); f.firebase.updatePassword=async()=>{f.calls.passwords.push('unknown');throw new Error('timeout');};
  await assert.rejects(f.reset(resetToken),{code:'RESET_OUTCOME_UNKNOWN'}); await assert.rejects(f.reset(resetToken),{code:'RESET_OUTCOME_UNKNOWN'});
  assert.equal(f.calls.passwords.length,1); assert.equal(f.calls.revocations.length,1); f.age(); await f.requestReset(); assert.equal(f.rows.at(-1).status,'PENDING');
});
test('definitive Firebase password policy rejection preserves the grant for a corrected password', async () => {
  const f=make(); const {resetToken}=await f.grant(); const update=f.firebase.updatePassword;
  f.firebase.updatePassword=async()=>{throw Object.assign(new Error('policy'),{code:'auth/password-does-not-meet-requirements'});};
  await assert.rejects(f.reset(resetToken),{code:'WEAK_PASSWORD'}); assert.equal(f.rows[0].status,'VERIFIED');
  f.firebase.updatePassword=update; await f.reset(resetToken); assert.equal(f.calls.passwords.length,1);
});

test('legacy resend remains an authenticated quota check and never dispatches an OTP for another body email', async t => {
  const { resendVerification } = await import('../controllers/AuthController.js');
  const { UserRepository } = await import('../repositories/UserRepository.js');
  const { AuditLogService } = await import('../services/AuditLogService.js');
  let lookedUp;
  t.mock.method(UserRepository.prototype, 'findByFirebaseUid', async uid => { lookedUp=uid; return {id:1,email:'owner@example.invalid',verificationResentCount:0}; });
  t.mock.method(UserRepository.prototype, 'update', async()=>({}));
  t.mock.method(AuditLogService,'log',async()=>{});
  const response={status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};
  await resendVerification({body:{email:'victim@example.invalid'},firebaseUser:{uid:'uid-1',email:'owner@example.invalid'}},response,error=>{throw error;});
  assert.equal(lookedUp,'uid-1'); assert.equal(response.statusCode,200); assert.equal(response.body.message,'Verification request accepted.');
  const { readFileSync }=await import('node:fs'); const routes=readFileSync(new URL('../routes/authRoutes.js',import.meta.url),'utf8');
  assert.match(routes,/resend-verification", resendVerificationRateLimiter, authenticateFirebaseToken, resendVerification/);
});
test('production requires a server OTP secret of at least 32 bytes and development has no shared known fallback', async t => {
  const { env, getOtpHmacSecret, getMissingRequiredConfig }=await import('../config/env.js');
  const secret=env.otp.hmacSecret; const nodeEnv=env.nodeEnv;
  t.after(()=>{env.otp.hmacSecret=secret;env.nodeEnv=nodeEnv;});
  env.nodeEnv='production'; env.otp.hmacSecret='short';
  assert.throws(getOtpHmacSecret,/at least 32/); assert.ok(getMissingRequiredConfig().includes('OTP_HMAC_SECRET'));
  env.otp.hmacSecret=undefined; assert.throws(getOtpHmacSecret,/required/);
  env.nodeEnv='test'; assert.equal(getOtpHmacSecret().length,64); assert.doesNotMatch(getOtpHmacSecret(),/testimonium-dev/);
});
test('new migration locks down only the OTP table/sequence and matches security state fields', async () => {
  const { readFileSync }=await import('node:fs');
  const sql=readFileSync(new URL('../prisma/migrations/20261026120000_add_otp_challenges/migration.sql',import.meta.url),'utf8');
  assert.match(sql,/ALTER TABLE "otp_challenges" ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON TABLE "otp_challenges" FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/REVOKE ALL ON SEQUENCE "otp_challenges_challenge_id_seq"/);
  for(const field of ['binding','operation_hash','operation_stage','operation_started_at']) assert.match(sql,new RegExp(`"${field}"`));
  assert.doesNotMatch(sql,/\b(DROP|TRUNCATE|DELETE|UPDATE)\b/);
});
test('changed Firebase email synchronizes UID-bound profile without trusting stale verified claims', async t => {
  const { AuthService }=await import('../services/AuthService.js');
  const { FirebaseAdminService }=await import('../services/FirebaseAdminService.js');
  const updates=[];
  const repository={findByFirebaseUid:async()=>({id:1,email:'old@example.invalid',firebaseUid:'uid-1',isVerified:true}),update:async(_id,data)=>{updates.push(data);return {id:1,firebaseUid:'uid-1',...data};}};
  const service=new AuthService(repository);
  service.toCurrentApplicationProfile=async(user,token)=>({user,token});
  t.mock.method(FirebaseAdminService.prototype,'getUser',async()=>({uid:'uid-1',email:'new@example.invalid',emailVerified:false}));
  const result=await service.getOrCreateApplicationUser({uid:'uid-1',email:'New@Example.invalid',email_verified:true});
  assert.deepEqual(updates,[{email:'new@example.invalid',isVerified:false}]); assert.equal(result.token.email_verified,false);
  await assert.rejects(service.getOrCreateApplicationUser({uid:'uid-1',email:'stale@example.invalid',email_verified:true}),{code:'STALE_IDENTITY'});
});

test('OTP preserves configured staff verification policy and trusted Google login', async t => {
  const { login }=await import('../controllers/AuthController.js');
  const { env }=await import('../config/env.js');
  const { AuditLogService }=await import('../services/AuditLogService.js');
  const previous=env.adminEmailVerificationRequired; const nodeEnv=env.nodeEnv;
  t.after(()=>{env.adminEmailVerificationRequired=previous;env.nodeEnv=nodeEnv;});
  t.mock.method(AuditLogService,'log',async()=>{}); env.nodeEnv='production';
  for(const [required,provider,status] of [[false,'password',200],[true,'password',403],[true,'google.com',200]]) {
    env.adminEmailVerificationRequired=required;
    const response={status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};
    await login({body:{},firebaseUser:{email_verified:false,firebase:{sign_in_provider:provider}},user:{id:1,role:'SECRETARY'}},response,error=>{throw error;});
    assert.equal(response.statusCode,status);
  }
});

test('OTP confirmation IP protection shares a budget across IPv6 address rotation', async t => {
  const {default:express}=await import('express');
  const {otpConfirmRateLimiter}=await import('../middlewares/rateLimit.js');
  const app=express();
  app.use((req,_res,next)=>{Object.defineProperty(req,'ip',{value:req.headers['x-fixture-ip']});next();});
  app.get('/fixture',otpConfirmRateLimiter,(_req,res)=>res.json({success:true}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}/fixture`;
  for(let n=1;n<=16;n++) {
    const response=await fetch(origin,{headers:{'x-fixture-ip':`2001:db8:1234::${n.toString(16)}`}});
    assert.equal(response.status,n<=15?200:429); await response.arrayBuffer();
  }
});

test('delivery errors never log provider payloads, OTPs or credentials', async t => {
  const {logger}=await import('../config/logger.js'); const entries=[];
  t.mock.method(logger,'warn',(...args)=>entries.push(args));
  const f=make(); f.delivery.send=async()=>{throw Object.assign(new Error('private-otp-000042'),{config:{data:'private-token'}});};
  await assert.rejects(f.request(),{code:'EMAIL_DELIVERY_FAILED'});
  assert.doesNotMatch(JSON.stringify(entries),/private-otp|000042|private-token/);
  assert.equal(entries.length,1);
});
test('missing request bodies return controlled errors or generic acknowledgements without database access', async () => {
  const controller=await import('../controllers/OtpController.js');
  for(const [action,status] of [['confirmEmailVerificationOtp',400],['verifyPasswordResetOtp',400],['completePasswordReset',400],['requestPasswordResetOtp',200]]) {
    const response={status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};
    await controller[action]({headers:{},firebaseUser:{uid:'uid-1',email:'owner@example.invalid'}},response,error=>{throw error;});
    assert.equal(response.statusCode,status);
  }
});

test('a failed audit write does not turn a completed reset into failure or permit replay', async () => {
  const f=make(); const actions=[];
  f.service.auditLog.log=async(_id,action)=>{actions.push(action);throw new Error('audit database unavailable');};
  const {resetToken}=await f.grant(); const result=await f.reset(resetToken);
  assert.equal(result.success,true); assert.deepEqual(actions,['Password Reset Requested','Password Reset Completed']);
  await f.reset(resetToken);assert.equal(f.calls.passwords.length,1);
});

test('production default limit is 15, development default is 30, and OTP_MAX_DAILY_SENDS overrides correctly', async () => {
  const { env, getOtpMaxDailySends } = await import('../config/env.js');
  const prevEnv = process.env.NODE_ENV;
  const prevOverride = process.env.OTP_MAX_DAILY_SENDS;

  try {
    delete process.env.OTP_MAX_DAILY_SENDS;
    process.env.NODE_ENV = 'production';
    assert.equal(getOtpMaxDailySends(), 15);
    assert.equal(env.otp.maxDailySends, 15);

    process.env.NODE_ENV = 'development';
    assert.equal(getOtpMaxDailySends(), 30);
    assert.equal(env.otp.maxDailySends, 30);

    process.env.OTP_MAX_DAILY_SENDS = '25';
    assert.equal(getOtpMaxDailySends(), 25);
    assert.equal(env.otp.maxDailySends, 25);

    // Fallback on invalid numbers
    process.env.OTP_MAX_DAILY_SENDS = 'invalid';
    assert.equal(getOtpMaxDailySends(), 30);
    process.env.OTP_MAX_DAILY_SENDS = '-5';
    assert.equal(getOtpMaxDailySends(), 30);
    process.env.OTP_MAX_DAILY_SENDS = '0';
    assert.equal(getOtpMaxDailySends(), 30);
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevOverride !== undefined) process.env.OTP_MAX_DAILY_SENDS = prevOverride;
    else delete process.env.OTP_MAX_DAILY_SENDS;
  }
});

test('existing quota history with 5 challenges is unblocked under development limit of 30', async () => {
  const f = make();
  // Simulate 5 existing requests already in DB from previous attempts
  for (let i = 0; i < 5; i++) {
    f.age();
    await f.request();
  }
  assert.equal(f.rows.length, 5);

  // After 60-second cooldown, request #6 is immediately allowed under the new 30-request limit
  f.age();
  const nextSend = await f.request();
  assert.equal(nextSend.success, true);
  assert.equal(f.rows.length, 6);
});

test('formatRemainingTime formats hours, minutes, and seconds accurately', async () => {
  const { formatRemainingTime } = await import('../services/OtpService.js');
  // 2 hours and 14 minutes = 2 * 3600 + 14 * 60 = 8040
  assert.equal(formatRemainingTime(8040), '2 hours and 14 minutes');
  assert.equal(formatRemainingTime(3660), '1 hour and 1 minute');
  assert.equal(formatRemainingTime(3600), '1 hour');
  assert.equal(formatRemainingTime(7200), '2 hours');
  assert.equal(formatRemainingTime(900), '15 minutes');
  assert.equal(formatRemainingTime(60), '1 minute');
  assert.equal(formatRemainingTime(45), '45 seconds');
  assert.equal(formatRemainingTime(1), '1 second');
});

test('quota error accurately includes calculated retryAfter from persisted challenges and rolling window', async () => {
  const f = make();
  f.service.maxDailySends = 2; // Test with small explicit limit

  // Request 1: 23 hours ago
  await f.request();
  f.rows[0].createdAt = new Date(Date.now() - 23 * 3600 * 1000);
  f.rows[0].lastSentAt = new Date(Date.now() - 23 * 3600 * 1000);

  // Request 2: 2 hours ago
  f.rows[0].lastSentAt = new Date(Date.now() - 61_000);
  await f.request();
  f.rows[1].createdAt = new Date(Date.now() - 2 * 3600 * 1000);
  f.rows[1].lastSentAt = new Date(Date.now() - 61_000);

  // Request 3: blocked by limit of 2. Oldest expirable challenge is Request 1 (created 23h ago).
  // Remaining time is ~1 hour (3600s).
  await assert.rejects(f.request(), (err) => {
    assert.equal(err.code, 'ACCOUNT_RESEND_LIMIT_EXCEEDED');
    assert.equal(err.statusCode, 429);
    // retryAfter should be around 3600 seconds (within a few seconds)
    assert.ok(err.retryAfter >= 3590 && err.retryAfter <= 3610);
    assert.match(err.message, /You've reached the verification email limit \(2 requests\)\. You can request another code in 1 hour\./);
    return true;
  });
});

test('purpose isolation: email verification quota does not affect password reset', async () => {
  const f = make();
  f.service.maxDailySends = 2;

  // Max out EMAIL_VERIFICATION
  await f.request();
  f.age();
  await f.request();
  f.age();
  await assert.rejects(f.request(), { code: 'ACCOUNT_RESEND_LIMIT_EXCEEDED' });

  // PASSWORD_RESET for the same user is not blocked by EMAIL_VERIFICATION challenges
  const resetRes = await f.requestReset();
  assert.equal(resetRes.success, true);
});
