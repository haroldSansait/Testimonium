import { z } from "zod";
import { resolveEventType } from "../shared/EventTypeCatalog.js";
import { strictPositiveIntSchema } from "./scheduleSchemas.js";
import { isValidStrictManilaDate } from "../services/ConflictHelper.js";

const timeSlotRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

const strictDateSchema = z.string({
  required_error: "preferredDate is required",
}).refine(isValidStrictManilaDate, {
  message: "Invalid calendar date. Expected valid YYYY-MM-DD.",
});

const strictOptionalDateSchema = z.string().refine(isValidStrictManilaDate, {
  message: "Invalid calendar date. Expected valid YYYY-MM-DD.",
}).optional().nullable();

export const scheduleRecommendationsSchema = z.object({
  parishId: strictPositiveIntSchema,
  eventType: z.string({
    required_error: "eventType is required",
  }).min(1, "eventType cannot be empty").refine(
    (val) => resolveEventType(val) !== null,
    { message: "Invalid eventType. Must be a canonical schedule event type." }
  ),
  preferredDate: strictDateSchema,
  dateFrom: strictOptionalDateSchema,
  dateTo: strictOptionalDateSchema,
  preferredTimeSlot: z.string().regex(timeSlotRegex, "Expected preferredTimeSlot format 'HH:MM AM/PM'").optional().nullable(),
  requestedPriestId: strictPositiveIntSchema.optional().nullable(),
}).superRefine((data, ctx) => {
  const hasFrom = data.dateFrom !== undefined && data.dateFrom !== null && data.dateFrom !== "";
  const hasTo = data.dateTo !== undefined && data.dateTo !== null && data.dateTo !== "";

  if (hasFrom !== hasTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dateFrom and dateTo must both be provided or both omitted.",
      path: ["dateFrom"],
    });
  } else if (hasFrom && hasTo && data.dateFrom > data.dateTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dateFrom cannot be later than dateTo.",
      path: ["dateFrom"],
    });
  }
});
