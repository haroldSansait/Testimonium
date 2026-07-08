import { Router } from "express";
import {
  list,
  create,
  update,
  disable,
  enable,
  resetPassword,
} from "../controllers/UserController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import { createUserSchema, updateUserSchema } from "../validators/userSchemas.js";

const router = Router();

// Apply authentication middleware
router.use(authenticateFirebaseToken);

// Apply authorization middleware — only Diocese Coordinators can manage users
router.use(checkRole(["DIOCESE_COORDINATOR"]));

// Routes
router.get("/", list);
router.post("/", validateBody(createUserSchema), create);
router.put("/:id", validateBody(updateUserSchema), update);
router.post("/:id/disable", disable);
router.post("/:id/enable", enable);
router.post("/:id/reset-password", resetPassword);

export default router;
