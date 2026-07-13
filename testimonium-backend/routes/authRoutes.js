import { Router } from "express";
import { getProfile, login, updateProfile } from "../controllers/AuthController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/profile", authenticateFirebaseToken, getProfile);
router.put("/profile", authenticateFirebaseToken, updateProfile);
router.post("/login", authenticateFirebaseToken, login);

export default router;
