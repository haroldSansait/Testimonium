import { Router } from "express";
import {
  list,
  getById,
  getByTracking,
  getPriestAvailability,
  create,
  createWeb,
  listAttachments,
  downloadAttachment,
  getConfiguration,
  getAvailabilityDates,
  getAvailableSlots,
  getEligiblePriests,
  getRecommendations,
  updateStatus,
  proposeReschedule,
  respondReschedule,
  assignPriest,
  assignLayMinister,
  respondPriestAssignment,
  emergencyReschedule,
} from "../controllers/ScheduleController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody } from "../middlewares/validateRequest.js";
import {
  createScheduleSchema,
  updateScheduleStatusSchema,
  proposeRescheduleSchema,
  respondRescheduleSchema,
  assignPriestSchema,
  assignLayMinisterSchema,
  priestAssignmentResponseSchema,
  emergencyRescheduleSchema,
} from "../validators/scheduleSchemas.js";
import { scheduleRecommendationsSchema } from "../validators/recommendationSchemas.js";
import { scheduleWebUpload } from "../middlewares/scheduleUploadMiddleware.js";
import {
  listAlternativeProposals,
  submitAlternativeProposal,
  withdrawAlternativeProposal,
  declineAlternativeProposal,
  nominateAlternativeProposalPriest,
  revokeAlternativeProposalNomination,
  respondAlternativeProposalNomination,
} from "../controllers/ScheduleAlternativeProposalController.js";
import {
  submitAlternativeProposalSchema,
  alternativeProposalRevisionSchema,
  declineAlternativeProposalSchema,
  nominateAlternativeProposalSchema,
  respondAlternativeProposalSchema,
} from "../validators/scheduleSchemas.js";

const router = Router();
const managingStaffRoles = ["SECRETARY"];

router.use(authenticateFirebaseToken);

router.get("/", list);
router.get("/configuration", getConfiguration);
router.get("/availability-dates", getAvailabilityDates);
router.get("/available-slots", getAvailableSlots);
router.get("/eligible-priests", getEligiblePriests);
router.post("/recommendations", validateBody(scheduleRecommendationsSchema), getRecommendations);
router.post("/", validateBody(createScheduleSchema), create);
router.post("/web", checkRole(["PARISHIONER"]), scheduleWebUpload, createWeb);
router.get("/:id/attachments", listAttachments);
router.get("/:id/attachments/:attachmentId/file", downloadAttachment);

router.get("/tracking/:reference", getByTracking);
router.get("/:id/priest-availability", checkRole(["SECRETARY", "PRIEST", "DIOCESE_COORDINATOR"]), getPriestAvailability);
router.get("/:id", getById);
router.patch("/:id/status", checkRole(managingStaffRoles), validateBody(updateScheduleStatusSchema), updateStatus);
router.post("/:id/propose-reschedule", checkRole(managingStaffRoles), validateBody(proposeRescheduleSchema), proposeReschedule);
router.post("/:id/respond-reschedule", checkRole(["PARISHIONER"]), validateBody(respondRescheduleSchema), respondReschedule);
router.post("/:id/assign-priest", checkRole(managingStaffRoles), validateBody(assignPriestSchema), assignPriest);
router.post("/:id/assign-lay-minister", checkRole(managingStaffRoles), validateBody(assignLayMinisterSchema), assignLayMinister);
router.get("/:id/alternative-proposals", listAlternativeProposals);
router.post("/:id/alternative-proposals", checkRole(["PARISHIONER"]), validateBody(submitAlternativeProposalSchema), submitAlternativeProposal);
router.post("/:id/alternative-proposals/:proposalId/withdraw", checkRole(["PARISHIONER"]), validateBody(alternativeProposalRevisionSchema), withdrawAlternativeProposal);
router.post("/:id/alternative-proposals/:proposalId/decline", checkRole(managingStaffRoles), validateBody(declineAlternativeProposalSchema), declineAlternativeProposal);
router.post("/:id/alternative-proposals/:proposalId/approve", checkRole(managingStaffRoles), validateBody(nominateAlternativeProposalSchema), nominateAlternativeProposalPriest);
router.post("/:id/alternative-proposals/:proposalId/revoke", checkRole(managingStaffRoles), validateBody(alternativeProposalRevisionSchema), revokeAlternativeProposalNomination);
router.post("/:id/alternative-proposals/:proposalId/priest-respond", checkRole(["PRIEST"]), validateBody(respondAlternativeProposalSchema), respondAlternativeProposalNomination);
router.post("/:id/priest-respond", checkRole(["PRIEST"]), validateBody(priestAssignmentResponseSchema), respondPriestAssignment);
router.post("/:id/emergency-reschedule", checkRole(managingStaffRoles), validateBody(emergencyRescheduleSchema), emergencyReschedule);

export default router;
