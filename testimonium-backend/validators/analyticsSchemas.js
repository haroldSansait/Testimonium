import { z } from "zod";
import { CANONICAL_SCHEDULE_EVENT_TYPES } from "../services/BookingValidator.js";
import { isValidStrictManilaDate, getCalendarDayRange } from "../utils/manilaAnalyticsDate.js";

const strictCalendarDate = z
  .string()
  .refine(isValidStrictManilaDate, {
    message: "Invalid calendar date. Expected valid YYYY-MM-DD.",
  })
  .optional();

const statuses = [
  "PENDING", "UNDER_REVIEW", "NEEDS_CORRECTION", "PAYMENT_PENDING",
  "PAYMENT_UNDER_REVIEW", "PAYMENT_NEEDS_CORRECTION", "PAYMENT_VERIFIED",
  "PROCESSING", "READY_FOR_SIGNING", "READY_FOR_PICKUP", "REQUESTED", "PROPOSED_RESCHEDULE",
  "WAITING_PARISHIONER_RESPONSE", "CONFIRMED", "COMPLETED", "RETURNED", "REJECTED", "CANCELLED",
];

export const descriptiveAnalyticsQuerySchema = z.object({
  from: strictCalendarDate,
  to: strictCalendarDate,
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


const strictPositiveIntString = z.string().regex(/^\d+$/, "Must be digits only").transform((val, ctx) => {
  const num = Number(val);
  if (!Number.isSafeInteger(num) || num <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Must be a positive safe integer",
    });
    return z.NEVER;
  }
  return num;
});

const strictPositiveInt = z.union([
  z.number().int().positive().refine((val) => Number.isSafeInteger(val), "Must be a safe integer"),
  strictPositiveIntString,
]);

const strictLimitString = z.string().regex(/^\d+$/, "Must be digits only").transform((val, ctx) => {
  const num = Number(val);
  if (!Number.isSafeInteger(num) || num <= 0 || num > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Limit must be between 1 and 100",
    });
    return z.NEVER;
  }
  return num;
});

const strictLimit = z.union([
  z.number().int().positive().refine((val) => Number.isSafeInteger(val) && val <= 100, "Limit must be between 1 and 100"),
  strictLimitString,
]).default(20);

const strictSearch = z
  .string()
  .max(100, "Search query cannot exceed 100 characters.")
  .transform((val) => val.trim())
  .transform((val) => (val.length === 0 ? undefined : val))
  .optional();

export const verifiedPaymentsQuerySchema = z
  .object({
    from: strictCalendarDate,
    to: strictCalendarDate,
    parishId: strictPositiveInt.optional(),
    documentType: z.enum([
      "BAPTISMAL_CERTIFICATE",
      "CONFIRMATION_CERTIFICATE",
      "MARRIAGE_CERTIFICATE",
      "FIRST_COMMUNION_CERTIFICATE",
      "MARRIAGE_BANNS",
      "PERMIT_TO_MARRY",
      "STATUS_OF_LIBERTY",
    ]).optional(),
    search: strictSearch,
    page: strictPositiveInt.default(1),
    limit: strictLimit,
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be on or before to.",
    path: ["to"],
  })
  .refine((value) => !value.from || !value.to || getCalendarDayRange(value.from, value.to) <= 366, {
    message: "Analytics date range must be between 1 and 366 days.",
    path: ["to"],
  });
