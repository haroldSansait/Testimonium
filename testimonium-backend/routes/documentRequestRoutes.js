import { Router } from "express";
import {
  list,
  updateStatus,
  downloadAttachment,
  getRegistrantIdEvidence,
  streamRegistrantIdEvidence,
  streamReceipt,
  uploadCorrectedDocument,
  getReturnHistory,
  streamReturnFile,
} from "../controllers/DocumentRequestController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import { updateRequestStatusSchema } from "../validators/requestSchemas.js";
import { uploadCorrectedDocumentFile } from "../middlewares/uploadMiddleware.js";

const router = Router();

const staffRoles = ["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"];
const managingStaffRoles = ["SECRETARY"];

router.use(authenticateFirebaseToken);
router.use(checkRole(staffRoles));

router.get("/", list);
router.patch("/:id/status", checkRole(managingStaffRoles), validateBody(updateRequestStatusSchema), updateStatus);
router.get("/:id/attachments/:attachmentId/download", downloadAttachment);
router.get("/:id/receipts/:receiptId/download", streamReceipt);
router.get("/:id/registrant-id", getRegistrantIdEvidence);
router.get("/:id/registrant-id/:side", streamRegistrantIdEvidence);

// Post-Release Document Return workflow (Staff endpoints)
router.post("/:id/corrected-document", checkRole(managingStaffRoles), uploadCorrectedDocumentFile, uploadCorrectedDocument);
router.get("/:id/returns", checkRole(staffRoles), getReturnHistory);
router.get("/:id/returns/:returnId/file/:type", checkRole(staffRoles), streamReturnFile);

export default router;
