import { Router } from "express";
import { getProfile } from "../controllers/AuthController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/profile", authenticateFirebaseToken, getProfile);

export default router;
