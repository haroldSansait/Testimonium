import { z } from "zod";
import { resolveEventType } from "../shared/EventTypeCatalog.js";

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
  remarks: z.string().optional().nullable(),
});
