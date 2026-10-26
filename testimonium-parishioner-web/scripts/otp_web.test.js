import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webSrc = path.join(__dirname, "../src");

test("1. OtpInput component exists and enforces 6-digit constraints", () => {
  const filePath = path.join(webSrc, "components/ui/OtpInput.tsx");
  assert.ok(fs.existsSync(filePath), "OtpInput.tsx must exist");
  const content = fs.readFileSync(filePath, "utf8");

  // Enforces 6 digits
  assert.match(content, /length:\s*6/);
  // Numeric keypad
  assert.match(content, /inputMode="numeric"/);
  assert.match(content, /pattern="\[0-9\]\*"/);
  assert.match(content, /maxLength=\{6\}/);
  // Backspace support
  assert.match(content, /One native input/);
  // Paste support
  assert.match(content, /onChange=\{handleChange\}/);
  assert.match(content, /slice\(0,\s*6\)/);
  // Single-use / auto-complete
  assert.match(content, /one-time-code/);
});

test("2. VerifyEmailPage is converted to 6-digit OTP verification", () => {
  const filePath = path.join(webSrc, "pages/public/VerifyEmailPage.tsx");
  assert.ok(fs.existsSync(filePath), "VerifyEmailPage.tsx must exist");
  const content = fs.readFileSync(filePath, "utf8");

  // Must import OtpInput
  assert.match(content, /import.*OtpInput.*from/);
  // Must use confirmEmailVerificationOtp
  assert.match(content, /confirmEmailVerificationOtp/);
  // Must use requestEmailVerificationOtp for resend and email changes
  assert.match(content, /requestEmailVerificationOtp/);
  // Must NOT use Firebase sendEmailVerification
  assert.doesNotMatch(content, /sendEmailVerification/);
  // Must include change email modal and updateEmail
  assert.match(content, /updateEmail/);
  assert.match(content, /cooldown/);
});

test("3. ForgotPasswordPage implements the 4-step recovery journey", () => {
  const filePath = path.join(webSrc, "pages/public/ForgotPasswordPage.tsx");
  assert.ok(fs.existsSync(filePath), "ForgotPasswordPage.tsx must exist");
  const content = fs.readFileSync(filePath, "utf8");

  // Must contain all 4 steps
  assert.match(content, /'EMAIL'/);
  assert.match(content, /'OTP'/);
  assert.match(content, /'NEW_PASSWORD'/);
  assert.match(content, /'SUCCESS'/);

  // Must call password reset endpoints
  assert.match(content, /\/auth\/password-reset\/request/);
  assert.match(content, /\/auth\/password-reset\/verify/);
  assert.match(content, /\/auth\/password-reset\/complete/);

  // Must use OtpInput
  assert.match(content, /OtpInput/);
  // Must evaluate password strength
  assert.match(content, /evaluatePasswordStrength/);
});

test("4. LoginPage links directly to /forgot-password without stale modal", () => {
  const filePath = path.join(webSrc, "pages/public/LoginPage.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  assert.match(content, /to="\/forgot-password"/);
  assert.doesNotMatch(content, /isForgotModalOpen/);
  assert.doesNotMatch(content, /contact your Diocese Coordinator/i);
});

test("5. App.tsx registers /forgot-password as a PublicRoute", () => {
  const filePath = path.join(webSrc, "App.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  assert.match(content, /import ForgotPasswordPage from/);
  assert.match(content, /path="\/forgot-password"/);
});

test("6. ProtectedRoute preserves email verification guard for password accounts", () => {
  const filePath = path.join(webSrc, "components/ProtectedRoute.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  assert.match(content, /isPasswordProvider/);
  assert.match(content, /to="\/verify-email"/);
});
