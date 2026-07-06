import { Router } from "express";
import { list } from "../controllers/ActivityLogController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";

const router = Router();

// Per schema docs: only the Diocese Coordinator/System Administrator may view activity logs.
router.use(authenticateFirebaseToken);
router.use(checkRole(["DIOCESE_COORDINATOR"]));

router.get("/", list);

export default router;
