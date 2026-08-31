import { z } from "zod";
import { CANONICAL_SCHEDULE_EVENT_TYPES } from "../services/BookingValidator.js";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD.");
const statuses = [
  "PENDING", "UNDER_REVIEW", "NEEDS_CORRECTION", "PAYMENT_PENDING",
  "PAYMENT_UNDER_REVIEW", "PAYMENT_NEEDS_CORRECTION", "PAYMENT_VERIFIED",
  "PROCESSING", "READY_FOR_PICKUP", "REQUESTED", "PROPOSED_RESCHEDULE",
  "WAITING_PARISHIONER_RESPONSE", "CONFIRMED", "COMPLETED", "REJECTED", "CANCELLED",
];

export const descriptiveAnalyticsQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  parishId: z.coerce.number().int().positive().optional(),
  documentType: z.enum([
    "BAPTISMAL_CERTIFICATE", "CONFIRMATION_CERTIFICATE", "MARRIAGE_CERTIFICATE",
    "FIRST_COMMUNION_CERTIFICATE", "MARRIAGE_BANNS", "PERMIT_TO_MARRY", "STATUS_OF_LIBERTY",
  ]).optional(),
  eventType: z.enum(CANONICAL_SCHEDULE_EVENT_TYPES).optional(),
  status: z.enum(statuses).optional(),
  category: z.enum(["MEETING", "ACTIVITY", "IMPORTANT_EVENT", "OTHER"]).optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "from must be on or before to.",
  path: ["to"],
});
