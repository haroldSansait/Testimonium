import { Router } from "express";
import { legalPolicyController } from "../controllers/LegalPolicyController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

const coordinatorAuth = [
  authenticateFirebaseToken,
  checkRole(["DIOCESE_COORDINATOR"]),
];

// Public retrieval of current active legal policies
router.get("/current", legalPolicyController.getCurrentPolicies);

// Diocese coordinator management endpoints
router.get("/manage", ...coordinatorAuth, legalPolicyController.getManagePolicies);
router.patch("/:policyType", ...coordinatorAuth, legalPolicyController.updatePolicy);

export default router;
