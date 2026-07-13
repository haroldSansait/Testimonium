import { Router } from "express";
import {
  create,
  submitDraft,
  cancel,
  list,
  getById,
  getByTracking,
  uploadFiles,
  uploadReceipt,
} from "../controllers/ParishionerRequestController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import { createRequestSchema } from "../validators/requestSchemas.js";
import {
  uploadRequestFiles,
  uploadReceiptFile,
} from "../middlewares/uploadMiddleware.js";

const router = Router();

// Apply auth check
router.use(authenticateFirebaseToken);

router.post("/", validateBody(createRequestSchema), create);
router.post("/:id/submit", submitDraft);
router.post("/:id/cancel", cancel);
router.get("/", list);
router.get("/tracking/:trackingNumber", getByTracking);
router.get("/:id", getById);

// File attachment uploads (limit 10)
router.post("/:id/files", uploadRequestFiles, uploadFiles);

// Payment proof receipt upload (single file)
router.post("/:id/receipt", uploadReceiptFile, uploadReceipt);

export default router;
