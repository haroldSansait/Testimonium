import { Router } from "express";
import { list, create, update, remove } from "../controllers/ParishEventController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

// All staff can list parish events for a parish
router.get("/:parishId", list);

// Only secretaries and diocese coordinators can perform mutations
router.post("/", checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]), create);
router.put("/:id", checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]), update);
router.delete("/:id", checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]), remove);

export default router;
