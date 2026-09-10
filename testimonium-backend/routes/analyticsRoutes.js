import { Router } from "express";
import {
  getOverview,
  getSacraments,
  getDocuments,
  getParishes,
  getDescriptive,
  getVerifiedPayments,
} from "../controllers/AnalyticsController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateQuery } from "../middlewares/validateRequest.js";
import {
  descriptiveAnalyticsQuerySchema,
  verifiedPaymentsQuerySchema,
} from "../validators/analyticsSchemas.js";

const router = Router();

// Apply authentication middleware
router.use(authenticateFirebaseToken);

router.get(
  "/descriptive",
  checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]),
  validateQuery(descriptiveAnalyticsQuerySchema),
  getDescriptive
);

router.get(
  "/payments/verified",
  checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]),
  validateQuery(verifiedPaymentsQuerySchema),
  getVerifiedPayments
);


// Apply authorization middleware to restrict access to Diocese Coordinators only
router.use(checkRole(["DIOCESE_COORDINATOR"]));

// Routes
router.get("/overview", getOverview);
router.get("/sacraments", getSacraments);
router.get("/documents", getDocuments);
router.get("/parishes", getParishes);

export default router;
