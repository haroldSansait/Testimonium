import { Router } from "express";
import {
  list,
  getById,
  getByTracking,
  getPriestAvailability,
  create,
  getConfiguration,
  getAvailabilityDates,
  getAvailableSlots,
  getEligiblePriests,
  getRecommendations,
  updateStatus,
  proposeReschedule,
  respondReschedule,
  assignPriest,
  respondPriestAssignment,
  emergencyReschedule,
} from "../controllers/ScheduleController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import {
  createScheduleSchema,
  updateScheduleStatusSchema,
  proposeRescheduleSchema,
  respondRescheduleSchema,
  assignPriestSchema,
  priestAssignmentResponseSchema,
  emergencyRescheduleSchema,
} from "../validators/scheduleSchemas.js";
import { scheduleRecommendationsSchema } from "../validators/recommendationSchemas.js";

const router = Router();

router.use(authenticateFirebaseToken);

router.get("/", list);
router.get("/configuration", getConfiguration);
router.get("/availability-dates", getAvailabilityDates);
router.get("/available-slots", getAvailableSlots);
router.get("/eligible-priests", getEligiblePriests);
router.post("/recommendations", validateBody(scheduleRecommendationsSchema), getRecommendations);
router.post("/", validateBody(createScheduleSchema), create);

router.get("/tracking/:reference", getByTracking);
router.get("/:id/priest-availability", checkRole(["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]), getPriestAvailability);
router.get("/:id", getById);
router.patch("/:id/status", checkRole(["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]), validateBody(updateScheduleStatusSchema), updateStatus);
router.post("/:id/propose-reschedule", checkRole(["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]), validateBody(proposeRescheduleSchema), proposeReschedule);
router.post("/:id/respond-reschedule", checkRole(["PARISHIONER"]), validateBody(respondRescheduleSchema), respondReschedule);
router.post("/:id/assign-priest", checkRole(["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]), validateBody(assignPriestSchema), assignPriest);
router.post("/:id/priest-respond", checkRole(["PRIEST"]), validateBody(priestAssignmentResponseSchema), respondPriestAssignment);
router.post("/:id/emergency-reschedule", checkRole(["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]), validateBody(emergencyRescheduleSchema), emergencyReschedule);

export default router;
