import { Router } from "express";
import { list, upsert, remove, reset, respondPriestAssignment } from "../controllers/MassScheduleController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

// All staff can list templates
router.get("/:parishId", list);

// Only secretaries can write templates
router.post("/:parishId", checkRole(["SECRETARY"]), upsert);
router.delete("/:id", checkRole(["SECRETARY"]), remove);
router.post("/:parishId/reset", checkRole(["SECRETARY"]), reset);

// Priest response to recurring template assignment
router.post("/:id/priest-respond", checkRole(["PRIEST"]), respondPriestAssignment);

export default router;
