import { Router } from "express";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody, validateQuery } from "../middlewares/validateRequest.js";
import {
  getConfiguration,
  replaceWeekdayRules,
  createDateRule,
  updateDateRule,
  deleteDateRule,
} from "../controllers/ScheduleAvailabilityController.js";
import {
  replaceWeekdayRulesSchema,
  dateRuleSchema,
  deleteDateRuleQuerySchema,
  listScheduleAvailabilityQuerySchema,
} from "../validators/scheduleAvailabilitySchemas.js";

const router = Router();
router.use(authenticateFirebaseToken);

router.get(
  "/parishes/:parishId",
  checkRole(["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]),
  validateQuery(listScheduleAvailabilityQuerySchema),
  getConfiguration
);
router.put(
  "/parishes/:parishId/weekday-rules",
  checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]),
  validateBody(replaceWeekdayRulesSchema),
  replaceWeekdayRules
);
router.post(
  "/parishes/:parishId/date-rules",
  checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]),
  validateBody(dateRuleSchema),
  createDateRule
);
router.patch(
  "/parishes/:parishId/date-rules/:ruleId",
  checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]),
  validateBody(dateRuleSchema),
  updateDateRule
);
router.delete(
  "/parishes/:parishId/date-rules/:ruleId",
  checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]),
  validateQuery(deleteDateRuleQuerySchema),
  deleteDateRule
);

export default router;
