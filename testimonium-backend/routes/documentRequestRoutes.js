import { Router } from "express";
import {
  list,
  updateStatus,
  downloadAttachment,
  getRegistrantIdEvidence,
  streamRegistrantIdEvidence,
  streamReceipt,
} from "../controllers/DocumentRequestController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import { updateRequestStatusSchema } from "../validators/requestSchemas.js";

const router = Router();

const staffRoles = ["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"];
const managingStaffRoles = ["SECRETARY", "DIOCESE_COORDINATOR"];

router.use(authenticateFirebaseToken);
router.use(checkRole(staffRoles));

router.get("/", list);
router.patch("/:id/status", checkRole(managingStaffRoles), validateBody(updateRequestStatusSchema), updateStatus);
router.get("/:id/attachments/:attachmentId/download", downloadAttachment);
router.get("/:id/receipts/:receiptId/download", streamReceipt);
router.get("/:id/registrant-id", getRegistrantIdEvidence);
router.get("/:id/registrant-id/:side", streamRegistrantIdEvidence);

export default router;
