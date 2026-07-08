import { Router } from "express";
import {
  getStats,
  getRecentActivity,
  getNotifications,
} from "../controllers/DioceseController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

// Apply authentication middleware
router.use(authenticateFirebaseToken);

// Apply authorization middleware to restrict access to Diocese Coordinators only
router.use(checkRole(["DIOCESE_COORDINATOR"]));

// Routes
router.get("/stats", getStats);
router.get("/activity", getRecentActivity);
router.get("/notifications", getNotifications);

export default router;
