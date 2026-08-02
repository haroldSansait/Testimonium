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
  documentSettings: z.any().optional().nullable(),
  eventSettings: z.any().optional().nullable(),
  officeHours: z.any().optional().nullable(),
});

export const updateParishSchema = createParishSchema.partial().extend({
  status: z.enum(["Active", "Inactive", "Archived"], {
    errorMap: () => ({ message: "Status must be Active, Inactive, or Archived" }),
  }).optional(),
  priestId: z.string().nullable().optional().or(z.number().nullable().optional()),
  secretaryId: z.string().nullable().optional().or(z.number().nullable().optional()),
});

export const updateMapItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((val) => parseInt(val, 10)),
  latitude: z.number()
    .min(10.0, "Latitude must be within the Diocese boundary (10.0 - 11.0)")
    .max(11.0, "Latitude must be within the Diocese boundary (10.0 - 11.0)"),
  longitude: z.number()
    .min(123.0, "Longitude must be within the Diocese boundary (123.0 - 123.6)")
    .max(123.6, "Longitude must be within the Diocese boundary (123.0 - 123.6)"),
  mapZoom: z.number().int().min(1).max(20).optional().nullable(),
  pinColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pin color must be a valid hex color code (e.g. #FF0000)").optional().nullable(),
  showLabel: z.boolean().optional().default(true),
  locationUpdatedAt: z.union([z.string(), z.date()]).optional().nullable(),
});

export const batchUpdateMapSchema = z.object({
  updates: z.array(updateMapItemSchema).nonempty("At least one update is required"),
});

export const updateDirectorySettingsSchema = z.object({
  directoryDescription: z.string().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
});

