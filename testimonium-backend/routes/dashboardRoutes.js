import { Router } from "express";
import {
  getAlerts,
  getSchedule,
  getStats,
} from "../controllers/DashboardController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

router.get("/stats", getStats);
router.get("/schedule", getSchedule);
router.get("/alerts", getAlerts);

export default router;
