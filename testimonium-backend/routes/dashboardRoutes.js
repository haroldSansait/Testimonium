import { Router } from "express";
import {
  getAlerts,
  getSchedule,
  getStats,
} from "../controllers/DashboardController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

router.get("/stats", checkRole(["SECRETARY", "DIOCESE_COORDINATOR", "PRIEST"]), getStats);
router.get("/schedule", checkRole(["SECRETARY", "DIOCESE_COORDINATOR", "PRIEST"]), getSchedule);
router.get("/alerts", checkRole(["SECRETARY", "DIOCESE_COORDINATOR", "PRIEST"]), getAlerts);

export default router;
