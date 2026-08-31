import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD.");
const reportFields = {
  reportDate: dateOnly,
  scope: z.enum(["PARISH", "DIOCESE"]),
  parishId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(255),
  category: z.enum(["MEETING", "ACTIVITY", "IMPORTANT_EVENT", "OTHER"]),
  description: z.string().trim().min(1).max(10000),
};

export const createReportSchema = z.object(reportFields);
export const updateReportSchema = z.object({
  ...reportFields,
  expectedVersion: z.coerce.number().int().positive(),
});

export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  scope: z.enum(["PARISH", "DIOCESE"]).optional(),
  parishId: z.coerce.number().int().positive().optional(),
  category: z.enum(["MEETING", "ACTIVITY", "IMPORTANT_EVENT", "OTHER"]).optional(),
  authorId: z.coerce.number().int().positive().optional(),
  keyword: z.string().trim().max(100).optional(),
  includeArchived: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "from must be on or before to.",
  path: ["to"],
});

export const archiveReportQuerySchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
});
