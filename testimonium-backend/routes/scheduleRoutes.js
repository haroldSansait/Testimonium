import { Router } from "express";
import { list } from "../controllers/ScheduleController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

const staffRoles = ["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"];

router.use(authenticateFirebaseToken);
router.use(checkRole(staffRoles));

router.get("/", list);

export default router;
