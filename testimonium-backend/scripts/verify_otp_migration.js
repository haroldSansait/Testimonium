import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const generated = readFileSync(process.argv[2], 'utf8');
const migration = readFileSync(new URL('../prisma/migrations/20261026120000_add_otp_challenges/migration.sql', import.meta.url), 'utf8');
const objects = [
  /CREATE TYPE "OtpPurpose" AS ENUM[^;]+;/,
  /CREATE TYPE "OtpStatus" AS ENUM[^;]+;/,
  /CREATE TABLE "otp_challenges" \([\s\S]*?\n\);/,
  ...['email_purpose','firebase_uid_purpose','status','expires_at','created_at'].map(name => new RegExp(`CREATE INDEX "otp_challenges_${name}_idx"[^;]+;`)),
];
for (const pattern of objects) {
  const expected = generated.match(pattern)?.[0];
  const actual = migration.match(pattern)?.[0];
  assert.ok(expected && actual, `Missing schema object: ${pattern}`);
  assert.equal(actual.replace(/\s+/g, ' '), expected.replace(/\s+/g, ' '), `Migration mismatch: ${pattern}`);
}
console.log(`${objects.length}/${objects.length} OTP schema objects exactly match Prisma-generated SQL. RLS/REVOKE additions are checked by test:otp.`);
