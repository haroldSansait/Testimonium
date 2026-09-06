import { z } from "zod";
import { resolveEventType } from "../shared/EventTypeCatalog.js";

const expectedVersion = z.coerce.number().int().positive();
const isoInstant = z.string().refine(
  (value) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && !Number.isNaN(Date.parse(value)),
  "Expected an ISO-8601 timestamp with an explicit UTC offset."
);

export const createScheduleSchema = z.object({
  parishId: z.coerce.number().int().positive("Parish ID must be a positive integer"),
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
  remarks: z.string().max(1000, "Additional notes cannot exceed 1000 characters").optional().nullable(),
});

export const updateScheduleStatusSchema = z.object({
  status: z.string().trim().min(1, "Status is required"),
  expectedVersion,
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
