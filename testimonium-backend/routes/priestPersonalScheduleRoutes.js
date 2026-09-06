import { Router } from "express";
import {
  list,
  getById,
  create,
  update,
  remove,
} from "../controllers/PriestPersonalScheduleController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody, validateQuery } from "../middlewares/validateRequest.js";
import {
  createPriestPersonalScheduleSchema,
  updatePriestPersonalScheduleSchema,
  deletePriestPersonalScheduleQuerySchema,
  listPriestPersonalScheduleQuerySchema,
} from "../validators/priestPersonalScheduleSchemas.js";

const router = Router();

router.use(authenticateFirebaseToken);
router.use(checkRole(["PRIEST"]));

router.get("/", validateQuery(listPriestPersonalScheduleQuerySchema), list);
router.get("/:id", getById);
router.post("/", validateBody(createPriestPersonalScheduleSchema), create);
router.patch("/:id", validateBody(updatePriestPersonalScheduleSchema), update);
router.delete("/:id", validateQuery(deletePriestPersonalScheduleQuerySchema), remove);

export default router;
