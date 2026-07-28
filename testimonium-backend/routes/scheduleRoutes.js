import { Router } from "express";
import { list, create, getAvailableSlots, updateStatus, proposeReschedule, respondReschedule, assignPriest, respondPriestAssignment } from "../controllers/ScheduleController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import { createScheduleSchema } from "../validators/scheduleSchemas.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateFirebaseToken);

// Parishioner-facing / general scheduling routes
router.get("/", list);
router.post("/", validateBody(createScheduleSchema), create);
router.get("/available-slots", getAvailableSlots);
router.patch("/:id/status", updateStatus);
router.post("/:id/propose-reschedule", proposeReschedule);
router.post("/:id/respond-reschedule", respondReschedule);
router.post("/:id/assign-priest", assignPriest);
router.post("/:id/priest-respond", checkRole(["PRIEST"]), respondPriestAssignment);

export default router;

