import { Router } from "express";
import {
  list,
  getById,
  create,
  update,
  archive,
  restore,
} from "../controllers/ParishController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import { createParishSchema, updateParishSchema } from "../validators/parishSchemas.js";

const router = Router();

// Apply authentication middleware
router.use(authenticateFirebaseToken);

// Apply authorization middleware — only Diocese Coordinators can modify parishes
router.use(checkRole(["DIOCESE_COORDINATOR"]));

// Routes
router.get("/", list);
router.get("/:id", getById);
router.post("/", validateBody(createParishSchema), create);
router.put("/:id", validateBody(updateParishSchema), update);
router.delete("/:id", archive);
router.post("/:id/restore", restore);

export default router;
