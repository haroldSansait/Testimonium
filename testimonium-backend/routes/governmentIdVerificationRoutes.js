import { Router } from "express";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { uploadGovernmentIdFiles } from "../middlewares/uploadMiddleware.js";
import { governmentIdRateLimiter } from "../middlewares/rateLimit.js";
import { defaultGovernmentIdVerificationController } from "../controllers/GovernmentIdVerificationController.js";

const router = Router();

// Require authentication for all identity verification endpoints
router.use(authenticateFirebaseToken);

// Parishioner ID verification submission (multipart: front, back) with rate limiter (~3 attempts / 10m)
router.post(
  "/submit",
  governmentIdRateLimiter,
  uploadGovernmentIdFiles,
  defaultGovernmentIdVerificationController.submit
);

// Parishioner ID verification status
router.get(
  "/status",
  defaultGovernmentIdVerificationController.getStatus
);

export default router;
