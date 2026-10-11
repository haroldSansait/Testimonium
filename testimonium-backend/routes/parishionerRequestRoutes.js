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
  resubmitCorrections,
  downloadAttachment,
  downloadReceipt,
  uploadRegistrantId,
  getRegistrantIdMetadata,
  streamOwnedRegistrantIdSide,
  returnDocument,
  getReturnHistory,
  streamReturnFile,
} from "../controllers/ParishionerRequestController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import { createRequestSchema } from "../validators/requestSchemas.js";
import {
  uploadRequestFiles,
  uploadReceiptFile,
  uploadRegistrantIdFiles,
  uploadReturnDocumentFile,
} from "../middlewares/uploadMiddleware.js";
import { receiptUploadRateLimiter, registrantIdUploadRateLimiter } from "../middlewares/rateLimit.js";

const router = Router();

// Apply auth check
router.use(authenticateFirebaseToken);
router.use(checkRole(["PARISHIONER"]));

router.post("/", validateBody(createRequestSchema), create);
router.post("/:id/submit", submitDraft);
router.post("/:id/cancel", cancel);
router.get("/", list);
router.get("/tracking/:trackingNumber", getByTracking);
router.get("/:id", getById);

// File attachment uploads (limit 10)
router.post("/:id/files", uploadRequestFiles, uploadFiles);
router.post("/:id/registrant-id", registrantIdUploadRateLimiter, uploadRegistrantIdFiles, uploadRegistrantId);
router.get("/:id/registrant-id", getRegistrantIdMetadata);
router.get("/:id/registrant-id/:side", streamOwnedRegistrantIdSide);

// Authenticated private attachment download
router.get("/:id/attachments/:attachmentId/download", downloadAttachment);
router.get("/:id/receipts/:receiptId/download", downloadReceipt);

// Payment proof receipt upload (single file)
router.post("/:id/receipt", receiptUploadRateLimiter, uploadReceiptFile, uploadReceipt);

// Resubmit corrected documents (Pre-release)
router.post("/:id/resubmit-corrections", resubmitCorrections);

// Post-Release Document Return workflow
router.post("/:id/return-document", uploadReturnDocumentFile, returnDocument);
router.get("/:id/returns", getReturnHistory);
router.get("/:id/returns/:returnId/file/:type", streamReturnFile);

export default router;
