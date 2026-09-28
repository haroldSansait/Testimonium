import { z } from "zod";

export const staffAssignmentSchema = z
  .object({
    mode: z.enum(["none", "existing", "new"]).default("none"),
    existingUserId: z.union([z.string(), z.number()]).optional().nullable(),
    newUserData: z
      .object({
        fullName: z.string().optional().nullable().or(z.literal("")),
        email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
        contactNumber: z.string().optional().nullable().or(z.literal("")),
      })
      .optional()
      .nullable(),
  })
  .optional()
  .nullable();

export const baseParishObject = z.object({
  name: z.string().min(1, "Parish name must be at least 1 character").optional(),
  type: z
    .enum(["Parish", "Quasi-Parish", "Mission Station"], {
      errorMap: () => ({ message: "Parish type must be one of: Parish, Quasi-Parish, Mission Station" }),
    })
    .optional(),
  vicariate: z.string().optional().nullable(),
  patronSaint: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  municipalityCity: z.string().trim().min(1, "Municipality / City is required").optional(),
  feastDay: z.string().trim().min(1, "Feast day is required").optional(),
  contactNumber: z.string().optional().nullable(),
  email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
  documentSettings: z.any().optional().nullable(),
  eventSettings: z.any().optional().nullable(),
  officeHours: z.any().optional().nullable(),
  venueCapacity: z.number().int().positive().max(10000).optional().nullable(),
  isMotherParish: z.boolean().optional(),
  parishInfo: z
    .object({
      name: z.string().min(1, "Parish name must be at least 1 character"),
      type: z.enum(["Parish", "Quasi-Parish", "Mission Station"], {
        errorMap: () => ({ message: "Parish type must be one of: Parish, Quasi-Parish, Mission Station" }),
      }),
      vicariate: z.string().optional().nullable(),
      municipalityCity: z.string().trim().min(1, "Municipality / City is required"),
      feastDay: z.string().trim().min(1, "Feast day is required"),
      patronSaint: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      contactNumber: z.string().optional().nullable(),
      email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
      isMotherParish: z.boolean().optional(),
    })
    .optional()
    .nullable(),
  priest: staffAssignmentSchema,
  secretary: staffAssignmentSchema,
});

export const createParishSchema = baseParishObject.refine(
  (data) => {
    const name = data.parishInfo?.name || data.name;
    const type = data.parishInfo?.type || data.type;
    const municipalityCity = data.parishInfo?.municipalityCity || data.municipalityCity;
    const feastDay = data.parishInfo?.feastDay || data.feastDay;
    return Boolean(name && type && municipalityCity && feastDay);
  },
  {
    message: "Parish name, type, municipality/city, and feast day are required",
    path: ["name"],
  }
);

export const updateParishSchema = baseParishObject.partial().extend({
  status: z.enum(["Active", "Inactive", "Archived"], {
    errorMap: () => ({ message: "Status must be Active, Inactive, or Archived" }),
  }).optional(),
  municipalityCity: z.string().trim().min(1, "Municipality / City cannot be empty").optional().nullable(),
  feastDay: z.string().trim().min(1, "Feast day cannot be empty").optional().nullable(),
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
