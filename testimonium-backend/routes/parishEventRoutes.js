import { Router } from "express";
import { list, listAll, create, update, remove, respondPriestAssignment } from "../controllers/ParishEventController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

// Authenticated parishioner discovery feed. This must precede /:parishId so
// Express does not interpret "all" as a parish identifier.
router.get("/all", listAll);

// Staff-only feed may include parish-private events within tenant scope.
router.get("/:parishId", checkRole(["SECRETARY", "DIOCESE_COORDINATOR", "PRIEST"]), list);

// Only secretaries and diocese coordinators can perform mutations
router.patch("/:id", checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]), update);
router.post("/", checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]), create);
router.put("/:id", checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]), update);
router.delete("/:id", checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]), remove);

// Priest can accept/reject assignments to parish events (Sunday masses, etc.)
router.post("/:id/priest-respond", checkRole(["PRIEST"]), respondPriestAssignment);

export default router;
