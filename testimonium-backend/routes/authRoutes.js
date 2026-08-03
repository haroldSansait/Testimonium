import { Router } from "express";
import { getProfile, login, updateProfile } from "../controllers/AuthController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { authLoginRateLimiter } from "../middlewares/rateLimit.js";

const router = Router();

router.get("/profile", authenticateFirebaseToken, getProfile);
router.put("/profile", authenticateFirebaseToken, updateProfile);
router.post("/login", authLoginRateLimiter, authenticateFirebaseToken, login);

export default router;

