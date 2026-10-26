import { Router } from "express";
import { getProfile, login, updateProfile, resendVerification, register, recordLegalAcceptance } from "../controllers/AuthController.js";
import {
  requestEmailVerificationOtp,
  confirmEmailVerificationOtp,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  completePasswordReset,
} from "../controllers/OtpController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import {
  authLoginRateLimiter,
  resendVerificationRateLimiter,
  userCreationRateLimiter,
  passwordResetRateLimiter,
  otpConfirmRateLimiter,
} from "../middlewares/rateLimit.js";

const router = Router();
router.use(["/otp", "/password-reset"], (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.get("/profile", authenticateFirebaseToken, getProfile);
router.put("/profile", authenticateFirebaseToken, updateProfile);
router.post("/login", authLoginRateLimiter, authenticateFirebaseToken, login);
router.post("/register", userCreationRateLimiter, authenticateFirebaseToken, register);
router.post("/legal-acceptance", authenticateFirebaseToken, recordLegalAcceptance);
// Installed clients send the Firebase link themselves after this quota check.
router.post("/resend-verification", resendVerificationRateLimiter, authenticateFirebaseToken, resendVerification);

// ── Email Verification OTP (Authenticated) ───────────────────────────────────
router.post("/otp/verification/request", resendVerificationRateLimiter, authenticateFirebaseToken, requestEmailVerificationOtp);
router.post("/otp/verification/confirm", otpConfirmRateLimiter, authenticateFirebaseToken, confirmEmailVerificationOtp);

// ── Password Reset Flow (Public) ─────────────────────────────────────────────
router.post("/password-reset/request", passwordResetRateLimiter, requestPasswordResetOtp);
router.post("/password-reset/verify", otpConfirmRateLimiter, verifyPasswordResetOtp);
router.post("/password-reset/complete", otpConfirmRateLimiter, completePasswordReset);

export default router;
