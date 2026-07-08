import { z } from "zod";

export const createParishSchema = z.object({
  name: z.string({
    required_error: "Parish name is required",
  }).min(1, "Parish name must be at least 1 character"),
  type: z.enum(["Parish", "Quasi-Parish", "Mission Station"], {
    errorMap: () => ({ message: "Parish type must be one of: Parish, Quasi-Parish, Mission Station" }),
  }),
  patronSaint: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
});

export const updateParishSchema = createParishSchema.partial().extend({
  status: z.enum(["Active", "Inactive", "Archived"], {
    errorMap: () => ({ message: "Status must be Active, Inactive, or Archived" }),
  }).optional(),
  priestId: z.string().nullable().optional().or(z.number().nullable().optional()),
  secretaryId: z.string().nullable().optional().or(z.number().nullable().optional()),
});
