import { z } from "zod";
import { resolveEventType } from "../shared/EventTypeCatalog.js";
import { SCHEDULE_REJECTION_REASON_CODES } from "../shared/ScheduleRejectionReasons.js";

const expectedVersion = z.coerce.number().int().positive();
const isoInstant = z.string().refine(
  (value) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && !Number.isNaN(Date.parse(value)),
  "Expected an ISO-8601 timestamp with an explicit UTC offset."
);

export const strictPositiveIntSchema = z.union([
  z.number().int().positive().refine((val) => Number.isSafeInteger(val), "Must be a safe integer"),
  z.string().regex(/^\d+$/, "Must be digits only").transform((val, ctx) => {
    const num = Number(val);
    if (!Number.isSafeInteger(num) || num <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a positive safe integer",
      });
      return z.NEVER;
    }
    return num;
  }),
]);

export const createScheduleSchema = z.object({
  parishId: strictPositiveIntSchema,
  eventType: z.string({
    required_error: "Event type is required"
  }).min(1, "Event type cannot be empty").refine(
    (val) => {
      const resolved = resolveEventType(val);
      return resolved !== null;
    },
    {
      message: "Invalid event type. The provided value cannot be mapped to any canonical schedule event."
    }
  ),
  date: z.string({
    required_error: "Date is required"
  }).min(1, "Date cannot be empty"),
  timeSlot: z.string({
    required_error: "Time slot is required"
  }).min(1, "Time slot cannot be empty"),
  displayTitle: z.string().optional().nullable(),
  location: z.string().trim().max(150, "Location cannot exceed 150 characters").optional().nullable(),
  remarks: z.string().max(1000, "Additional notes cannot exceed 1000 characters").optional().nullable(),
  requestedPriestId: strictPositiveIntSchema.optional().nullable(),
});

const eventTypeStringSchema = z.string({
  required_error: "Event type is required"
}).min(1, "Event type cannot be empty").refine(
  (val) => resolveEventType(val) !== null,
  {
    message: "Invalid event type. The provided value cannot be mapped to any canonical schedule event."
  }
);

const optionalDraftDateSchema = z
  .string()
  .trim()
  .refine(
    (val) => val === "" || (/^\d{4}-\d{2}-\d{2}/.test(val) && !Number.isNaN(Date.parse(val))),
    "Invalid date format. Expected YYYY-MM-DD."
  )
  .optional()
  .nullable();

const optionalDraftTimeSlotSchema = z
  .string()
  .trim()
  .max(20, "Time slot cannot exceed 20 characters")
  .optional()
  .nullable();

export const createScheduleDraftSchema = z.object({
  parishId: strictPositiveIntSchema,
  eventType: eventTypeStringSchema,
  displayTitle: z.string().max(150).optional().nullable(),
  preferredDate: optionalDraftDateSchema,
  date: optionalDraftDateSchema,
  requestedDate: optionalDraftDateSchema,
  timeSlot: optionalDraftTimeSlotSchema,
  location: z.string().trim().max(150, "Location cannot exceed 150 characters").optional().nullable(),
  remarks: z.string().max(1000, "Additional notes cannot exceed 1000 characters").optional().nullable(),
  requestedPriestId: strictPositiveIntSchema.optional().nullable(),
}).strict();

export const updateScheduleDraftSchema = z.object({
  parishId: strictPositiveIntSchema.optional(),
  eventType: eventTypeStringSchema.optional(),
  displayTitle: z.string().max(150).optional().nullable(),
  preferredDate: optionalDraftDateSchema,
  date: optionalDraftDateSchema,
  requestedDate: optionalDraftDateSchema,
  timeSlot: optionalDraftTimeSlotSchema,
  location: z.string().trim().max(150, "Location cannot exceed 150 characters").optional().nullable(),
  remarks: z.string().max(1000, "Additional notes cannot exceed 1000 characters").optional().nullable(),
  requestedPriestId: strictPositiveIntSchema.optional().nullable(),
  removedRequirementIds: z.array(z.string().trim().min(1)).max(10).optional(),
}).strict();

export const submitScheduleDraftSchema = z.object({
  parishId: strictPositiveIntSchema.optional(),
  eventType: eventTypeStringSchema.optional(),
  displayTitle: z.string().max(150).optional().nullable(),
  preferredDate: optionalDraftDateSchema,
  date: optionalDraftDateSchema,
  requestedDate: optionalDraftDateSchema,
  timeSlot: optionalDraftTimeSlotSchema,
  location: z.string().trim().max(150, "Location cannot exceed 150 characters").optional().nullable(),
  remarks: z.string().max(1000, "Additional notes cannot exceed 1000 characters").optional().nullable(),
  requestedPriestId: strictPositiveIntSchema.optional().nullable(),
}).strict();

export const updateScheduleStatusSchema = z.object({
  status: z.string().trim().min(1, "Status is required"),
  expectedVersion,
  rejectionReasonCode: z.enum(SCHEDULE_REJECTION_REASON_CODES).optional().nullable(),
  affectedRequirementIds: z.array(z.string().trim().min(1)).optional(),
  rejectionNote: z.string().trim().max(1000, "Parishioner-visible note cannot exceed 1000 characters").optional().nullable(),
}).superRefine((payload, ctx) => {
  if (payload.status.trim().toUpperCase() === "REJECTED" && !payload.rejectionReasonCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rejectionReasonCode"],
      message: "A valid rejection reason is required.",
    });
  }
});

export const proposeRescheduleSchema = z.object({
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD."),
  proposedStartDatetime: isoInstant.optional().nullable(),
  proposedEndDatetime: isoInstant.optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
  expectedVersion,
});

export const respondRescheduleSchema = z.object({
  accept: z.boolean(),
  expectedVersion,
});

export const assignPriestSchema = z.object({
  priestId: z.coerce.number().int().positive(),
  expectedVersion,
});

export const assignLayMinisterSchema = z.object({
  expectedVersion,
  reason: z.string().trim().min(5, "Assignment reason must contain at least 5 characters").max(1000),
});

export const priestAssignmentResponseSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
  reason: z.string().trim().max(1000).optional().nullable(),
  expectedVersion,
});

export const emergencyRescheduleSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD."),
  timeSlot: z.string().trim().min(1, "Time slot is required").max(20),
  reason: z.string().trim().min(5, "Emergency reason must contain at least 5 characters").max(1000),
  expectedVersion,
});

export const submitAlternativeProposalSchema = z.object({
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD."),
  timeSlot: z.string().trim().min(1).max(20),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const alternativeProposalRevisionSchema = z.object({
  expectedRevision: z.coerce.number().int().nonnegative(),
});

export const declineAlternativeProposalSchema = alternativeProposalRevisionSchema.extend({
  reason: z.string().trim().min(5).max(1000),
});

export const nominateAlternativeProposalSchema = alternativeProposalRevisionSchema.extend({
  priestId: strictPositiveIntSchema,
  expectedVersion,
});

export const respondAlternativeProposalSchema = alternativeProposalRevisionSchema.extend({
  status: z.enum(["ACCEPTED", "REJECTED"]),
  reason: z.string().trim().max(1000).optional().nullable(),
});
