import { Router } from "express";
import { getEvents, getPriestCalendar } from "../controllers/CalendarController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

// The combined staff calendar includes private parish events and operational
// schedule details; parishioner clients must use /parish-events/all.
router.get("/events", checkRole(["SECRETARY", "DIOCESE_COORDINATOR", "PRIEST"]), getEvents);

// Dedicated priest personal calendar projection
router.get("/priest", checkRole(["PRIEST"]), getPriestCalendar);
router.get("/priest-calendar", checkRole(["PRIEST"]), getPriestCalendar);

export default router;
