import { Router } from "express";
import {
  list,
  markAllRead,
  markOneRead,
} from "../controllers/NotificationController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { registerDevice, unregisterDevice } from "../controllers/PushDeviceController.js";

const router = Router();

router.use(authenticateFirebaseToken);
router.post("/devices", registerDevice);
router.delete("/devices", unregisterDevice);

router.get("/", list);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markOneRead);

export default router;
