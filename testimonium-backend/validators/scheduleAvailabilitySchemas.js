import { z } from "zod";
import { CANONICAL_SCHEDULE_EVENT_TYPES } from "../services/BookingValidator.js";
import { WEEKDAYS } from "../services/SchedulingAvailability.js";

const expectedVersion = z.coerce.number().int().positive();
const weekday = z.enum(WEEKDAYS);
const eventType = z.enum(CANONICAL_SCHEDULE_EVENT_TYPES);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD.");

export const replaceWeekdayRulesSchema = z.object({
  expectedVersion,
  parishRules: z.array(z.object({ weekday, isAvailable: z.boolean() })).length(7),
  serviceRules: z.array(z.object({ eventType, weekday, isAvailable: z.boolean() })).max(112),
  eventSettings: z.record(z.string(), z.unknown()).optional(),
  officeHours: z.record(z.string(), z.unknown()).optional(),
});

export const dateRuleSchema = z.object({
  expectedVersion,
  exceptionDate: dateOnly,
  baseMode: z.enum(["INHERIT", "AVAILABLE", "UNAVAILABLE"]),
  reason: z.string().trim().max(255).nullable().optional(),
  serviceOverrides: z.array(z.object({
    eventType,
    mode: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  })).max(16).default([]),
});

export const deleteDateRuleQuerySchema = z.object({ expectedVersion });

export const listScheduleAvailabilityQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "from must be on or before to.",
  path: ["to"],
});
