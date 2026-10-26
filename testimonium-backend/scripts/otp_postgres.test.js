// Explicit opt-in only. Never loads dotenv or falls back to configured app URLs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
const databaseUrl = process.env.OTP_TEST_DATABASE_URL;

test('disposable PostgreSQL: migration, RLS, atomic resend/attempt/grant transitions', {skip: !databaseUrl && 'Set OTP_TEST_DATABASE_URL to an empty local otp_audit_* database; Docker engine unavailable in this audit', timeout: 120000}, async t => {
  const target = new URL(databaseUrl);
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(target.hostname), 'Only explicit loopback PostgreSQL is permitted');
  assert.match(target.pathname, /^\/otp_audit_[a-z0-9_]+$/i, 'A dedicated disposable database name is required');
  Object.assign(process.env, { DATABASE_URL: databaseUrl, SUPABASE_DATABASE_URL: databaseUrl, NODE_ENV: 'test', LOG_LEVEL: 'silent', OTP_HMAC_SECRET: 'disposable-postgres-test-secret-minimum-32' });
  const client = new pg.Client({connectionString:databaseUrl}); await client.connect();
  let prisma;
  let migrated = false;
  t.after(async()=>{
    await prisma?.$disconnect();
    await client.query('RESET ROLE');
    if (migrated) await client.query('DROP TABLE IF EXISTS otp_challenges; DROP TYPE IF EXISTS "OtpStatus"; DROP TYPE IF EXISTS "OtpPurpose";');
    await client.end();
  });
  const existing=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  assert.equal(existing.rows.length,0,'Refusing to modify a database with existing public tables');
  // Supabase supplies these roles; the standalone disposable cluster may not.
  await client.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$");
  const sql=await readFile(new URL('../prisma/migrations/20261026120000_add_otp_challenges/migration.sql',import.meta.url),'utf8');
  await client.query(sql);
  migrated = true;
  const { PrismaClient }=await import('@prisma/client');
  const { PrismaPg }=await import('@prisma/adapter-pg');
  prisma=new PrismaClient({adapter:new PrismaPg({connectionString:databaseUrl})});
  const { OtpService }=await import('../services/OtpService.js');
  const { fixture }=await import('./helpers/otp-fixture.js');
  const f=fixture(OtpService); f.service.prisma=prisma;
  await Promise.all(Array.from({length:10},()=>f.service.requestPasswordResetOtp(f.identity)));
  await Promise.all([...f.service.dispatches]);
  assert.equal(await prisma.otpChallenge.count(),1); assert.equal(f.mails.length,1);
  const wrong=f.code()==='999999'?'888888':'999999';
  await Promise.allSettled(Array.from({length:20},()=>f.service.verifyPasswordResetOtp({email:f.identity.email,code:wrong})));
  const exhausted=await prisma.otpChallenge.findFirst(); assert.equal(exhausted.attempts,5); assert.equal(exhausted.status,'FAILED');
  await prisma.otpChallenge.updateMany({data:{createdAt:new Date(Date.now()-61000),lastSentAt:new Date(Date.now()-61000)}});
  await f.requestReset();
  const verified=await Promise.allSettled([0,1].map(()=>f.service.verifyPasswordResetOtp({email:f.identity.email,code:f.code()})));
  assert.equal(verified.filter(r=>r.status==='fulfilled').length,1);
  const {resetToken}=verified.find(r=>r.status==='fulfilled').value;
  await Promise.allSettled([f.reset(resetToken),f.reset(resetToken)]);
  assert.equal(f.calls.passwords.length,1); assert.equal(f.calls.revocations.length,1);
  for(const role of ['anon','authenticated']) {
    await client.query(`SET ROLE ${role}`);
    await assert.rejects(client.query('SELECT * FROM otp_challenges'),{code:'42501'});
    await assert.rejects(client.query('SELECT nextval(\'otp_challenges_challenge_id_seq\')'),{code:'42501'});
    await client.query('RESET ROLE');
  }
});
