import { Router } from "express";
import { getEvents } from "../controllers/CalendarController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

router.get("/events", getEvents);

export default router;
