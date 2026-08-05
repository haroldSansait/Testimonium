import { Router } from "express";
import { getProfile, login, updateProfile, resendVerification, register, recordLegalAcceptance } from "../controllers/AuthController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { authLoginRateLimiter, resendVerificationRateLimiter, userCreationRateLimiter } from "../middlewares/rateLimit.js";

const router = Router();

router.get("/profile", authenticateFirebaseToken, getProfile);
router.put("/profile", authenticateFirebaseToken, updateProfile);
router.post("/login", authLoginRateLimiter, authenticateFirebaseToken, login);
router.post("/register", userCreationRateLimiter, authenticateFirebaseToken, register);
router.post("/legal-acceptance", authenticateFirebaseToken, recordLegalAcceptance);
router.post("/resend-verification", resendVerificationRateLimiter, resendVerification);

export default router;

