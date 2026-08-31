import { Router } from "express";
import { getEvents } from "../controllers/CalendarController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

// The combined staff calendar includes private parish events and operational
// schedule details; parishioner clients must use /parish-events/all.
router.get("/events", checkRole(["SECRETARY", "DIOCESE_COORDINATOR", "PRIEST"]), getEvents);

export default router;
