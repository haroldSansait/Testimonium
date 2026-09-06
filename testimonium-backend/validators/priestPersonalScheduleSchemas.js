import { z } from "zod";

const isoInstant = z.string().refine(
  (value) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && !Number.isNaN(Date.parse(value)),
  "Expected an ISO-8601 timestamp with an explicit UTC offset."
);
const expectedVersion = z.coerce.number().int().positive();

export const createPriestPersonalScheduleSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").max(150, "Title cannot exceed 150 characters"),
    notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
    startAt: isoInstant,
    endAt: isoInstant,
  })
  .refine((data) => new Date(data.endAt).getTime() > new Date(data.startAt).getTime(), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

export const updatePriestPersonalScheduleSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").max(150, "Title cannot exceed 150 characters").optional(),
    notes: z.string().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
    startAt: isoInstant.optional(),
    endAt: isoInstant.optional(),
    expectedVersion,
  })
  .refine(
    (data) => data.title !== undefined || data.notes !== undefined || data.startAt !== undefined || data.endAt !== undefined,
    "At least one personal schedule field must be provided."
  )
  .refine(
    (data) => !data.startAt || !data.endAt || new Date(data.endAt).getTime() > new Date(data.startAt).getTime(),
    {
      message: "endAt must be after startAt",
      path: ["endAt"],
    }
  );

export const deletePriestPersonalScheduleQuerySchema = z.object({ expectedVersion });

export const listPriestPersonalScheduleQuerySchema = z
  .object({
    startDate: isoInstant.optional(),
    endDate: isoInstant.optional(),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || new Date(data.endDate).getTime() > new Date(data.startDate).getTime(),
    {
      message: "endDate must be after startDate",
      path: ["endDate"],
    }
  );
