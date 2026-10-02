import { Router } from "express";
import {
  list,
  create,
  update,
  disable,
  enable,
  resetPassword,
  updateColor,
} from "../controllers/UserController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import { createUserSchema, updateUserSchema } from "../validators/userSchemas.js";
import { userCreationRateLimiter, passwordResetRateLimiter } from "../middlewares/rateLimit.js";

import { defaultGovernmentIdVerificationController } from "../controllers/GovernmentIdVerificationController.js";

const router = Router();

// Apply authentication middleware
router.use(authenticateFirebaseToken);

// Routes
router.get("/", (req, res, next) => {
  // Allow Diocese Coordinators always; allow Secretaries and Priests only when querying Priests
  if (req.user.role === "DIOCESE_COORDINATOR") {
    return next();
  }
  if ((req.user.role === "SECRETARY" || req.user.role === "PRIEST") && req.query.role === "PRIEST") {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "You do not have permission to view this user directory."
  });
}, list);

router.post("/", userCreationRateLimiter, checkRole(["DIOCESE_COORDINATOR"]), validateBody(createUserSchema), create);
router.put("/:id/color", checkRole(["DIOCESE_COORDINATOR", "SECRETARY"]), updateColor);
router.put("/:id", checkRole(["DIOCESE_COORDINATOR"]), validateBody(updateUserSchema), update);
router.post("/:id/disable", checkRole(["DIOCESE_COORDINATOR"]), disable);
router.post("/:id/enable", checkRole(["DIOCESE_COORDINATOR"]), enable);
router.post("/:id/reset-password", passwordResetRateLimiter, checkRole(["DIOCESE_COORDINATOR"]), resetPassword);

// Coordinator Government ID verification inspection routes
router.get("/:id/identity/status", checkRole(["DIOCESE_COORDINATOR"]), defaultGovernmentIdVerificationController.getCoordinatorUserStatus);
router.get("/:id/identity/front-image", checkRole(["DIOCESE_COORDINATOR"]), defaultGovernmentIdVerificationController.getCoordinatorFrontImage);
router.get("/:id/identity/back-image", checkRole(["DIOCESE_COORDINATOR"]), defaultGovernmentIdVerificationController.getCoordinatorBackImage);

export default router;

