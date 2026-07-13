import { Router } from "express";
import { list, create, getAvailableSlots, updateStatus } from "../controllers/ScheduleController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
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

export default router;

