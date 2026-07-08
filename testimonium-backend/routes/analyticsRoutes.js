import { Router } from "express";
import {
  getOverview,
  getSacraments,
  getDocuments,
  getParishes
} from "../controllers/AnalyticsController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

// Apply authentication middleware
router.use(authenticateFirebaseToken);

// Apply authorization middleware to restrict access to Diocese Coordinators only
router.use(checkRole(["DIOCESE_COORDINATOR"]));

// Routes
router.get("/overview", getOverview);
router.get("/sacraments", getSacraments);
router.get("/documents", getDocuments);
router.get("/parishes", getParishes);

export default router;
