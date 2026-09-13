import { Router } from "express";
import { caloyAdminController } from "../controllers/CaloyAdminController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody, validateQuery } from "../middlewares/validateRequest.js";
import {
  caloySettingsUpdateSchema,
  caloyAnalyticsQuerySchema,
  caloyLogsQuerySchema,
  caloyPurgePreviewQuerySchema,
  caloyPurgeExecuteSchema,
} from "../validators/caloyAdminSchemas.js";

const router = Router();

// ==============================================================================
// AUTHORIZATION: DIOCESE_COORDINATOR ONLY
// Note: Intentionally NOT gated behind chatbot-enabled runtime middleware
// so coordinators can always inspect telemetry, settings, and re-enable Caloy.
// ==============================================================================
const coordinatorAuth = [authenticateFirebaseToken, checkRole(["DIOCESE_COORDINATOR"])];

router.use(...coordinatorAuth);

router.get("/overview", caloyAdminController.getOverview);

router.get(
  "/analytics",
  validateQuery(caloyAnalyticsQuerySchema),
  caloyAdminController.getAnalytics
);

router.get("/settings", caloyAdminController.getSettings);

router.patch(
  "/settings",
  validateBody(caloySettingsUpdateSchema),
  caloyAdminController.updateSettings
);

router.get(
  "/logs",
  validateQuery(caloyLogsQuerySchema),
  caloyAdminController.getLogs
);

router.get(
  "/logs/purge-preview",
  validateQuery(caloyPurgePreviewQuerySchema),
  caloyAdminController.getPurgePreview
);

router.post(
  "/logs/purge",
  validateBody(caloyPurgeExecuteSchema),
  caloyAdminController.executePurge
);

router.get("/knowledge-stats", caloyAdminController.getKnowledgeStats);

export default router;
