import { Router } from "express";
import {
  list,
  getById,
  create,
  update,
  archive,
  restore,
  updateSettings,
  uploadPaymentQr,
  deletePaymentQr,
} from "../controllers/ParishController.js";
import {
  getMapConfig,
  batchUpdateMap,
  updateSettings as updateDirectorySettings,
  uploadImage,
} from "../controllers/ParishMapController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import {
  createParishSchema,
  updateParishSchema,
  batchUpdateMapSchema,
  updateDirectorySettingsSchema,
} from "../validators/parishSchemas.js";
import {
  mapSaveRateLimiter,
  parishImageUploadRateLimiter,
} from "../middlewares/rateLimit.js";
import multer from "multer";

const router = Router();
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
const memoryUpload2MB = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max for QR codes
  },
});

// Apply authentication middleware
router.use(authenticateFirebaseToken);

// Map Configuration static routes (defined before /:id parameter routes)
router.get("/map-config", checkRole(["DIOCESE_COORDINATOR"]), getMapConfig);
router.patch("/map-config/batch", checkRole(["DIOCESE_COORDINATOR"]), mapSaveRateLimiter, validateBody(batchUpdateMapSchema), batchUpdateMap);

// Publicly read parishes for all authenticated users
router.get("/", list);
router.get("/:id", getById);

// Parish Settings & Payment QR management (Accessible by DIOCESE_COORDINATOR, SECRETARY, PRIEST)
router.put("/:id/settings", checkRole(["DIOCESE_COORDINATOR", "SECRETARY", "PRIEST"]), updateSettings);
router.patch("/:id/settings", checkRole(["DIOCESE_COORDINATOR", "SECRETARY", "PRIEST"]), updateSettings);
router.post("/:id/payment-qr", checkRole(["DIOCESE_COORDINATOR", "SECRETARY", "PRIEST"]), parishImageUploadRateLimiter, memoryUpload2MB.single("qrImage"), uploadPaymentQr);
router.delete("/:id/payment-qr", checkRole(["DIOCESE_COORDINATOR", "SECRETARY", "PRIEST"]), deletePaymentQr);

// Apply authorization middleware — only Diocese Coordinators can modify parishes
router.use(checkRole(["DIOCESE_COORDINATOR"]));

// Map Settings and Images (parameter-based)
router.patch("/:id/settings", validateBody(updateDirectorySettingsSchema), updateDirectorySettings);
router.post("/:id/images", parishImageUploadRateLimiter, memoryUpload.single("image"), uploadImage);

// General CRUD Routes
router.post("/", validateBody(createParishSchema), create);
router.put("/:id", validateBody(updateParishSchema), update);
router.delete("/:id", archive);
router.post("/:id/restore", restore);

export default router;
