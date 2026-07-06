import { Router } from "express";
import {
  list,
  markAllRead,
  markOneRead,
} from "../controllers/NotificationController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

router.get("/", list);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markOneRead);

export default router;
