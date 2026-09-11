import { z } from "zod";

const KNOWLEDGE_SOURCE_TYPES = [
  "SYSTEM_GUIDE",
  "PARISH_PROCEDURE",
  "DIOCESE_PROCEDURE",
  "CLERGY_INTERVIEW",
  "OFFICIAL_SOURCE",
  "LEGACY_FAQ",
  "ADMIN_ENTRY",
];

const chunkSchema = z.object({
  content: z
    .string({ required_error: "Chunk content is required" })
    .min(10, "Chunk content must be at least 10 characters")
    .max(2000, "Chunk content must not exceed 2000 characters"),
  chunkOrder: z.number().int().nonnegative().optional(),
});

export const createKnowledgeSourceSchema = z
  .object({
    title: z
      .string({ required_error: "Title is required" })
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must not exceed 200 characters"),
    sourceText: z
      .string({ required_error: "Source text is required" })
      .min(10, "Source text must be at least 10 characters")
      .max(20000, "Source text must not exceed 20000 characters"),
    category: z.string().max(100).optional().nullable(),
    sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES, {
      errorMap: () => ({ message: "Invalid source type" }),
    }),
    sourceReference: z
      .string()
      .max(500)
      .refine(
        (val) => {
          if (!val) return true;
          const lower = val.toLowerCase().trim();
          if (lower.startsWith("http://") || lower.startsWith("javascript:")) return false;
          return true;
        },
        "Insecure URLs (http, javascript) are not allowed; use HTTPS or plain reference"
      )
      .optional()
      .nullable(),
    scope: z.enum(["DIOCESE", "PARISH"], {
      errorMap: () => ({ message: "Scope must be DIOCESE or PARISH" }),
    }),
    parishId: z.number().int().positive().optional().nullable(),
    chunks: z
      .array(chunkSchema, { required_error: "At least one chunk is required" })
      .min(1, "At least one chunk is required"),
  })
  .strict();

export const updateKnowledgeSourceSchema = z
  .object({
    expectedVersion: z
      .number({ required_error: "expectedVersion is required for concurrency control" })
      .int("expectedVersion must be an integer")
      .positive("expectedVersion must be a positive integer"),
    title: z.string().min(3).max(200).optional(),
    sourceText: z.string().min(10).max(20000).optional(),
    category: z.string().max(100).optional().nullable(),
    sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES).optional(),
    sourceReference: z
      .string()
      .max(500)
      .refine(
        (val) => {
          if (!val) return true;
          const lower = val.toLowerCase().trim();
          if (lower.startsWith("http://") || lower.startsWith("javascript:")) return false;
          return true;
        },
        "Insecure URLs (http, javascript) are not allowed; use HTTPS or plain reference"
      )
      .optional()
      .nullable(),
    scope: z.enum(["DIOCESE", "PARISH"]).optional(),
    parishId: z.number().int().positive().optional().nullable(),
    chunks: z.array(chunkSchema).optional(),
  })
  .strict();

export const versionedActionSchema = z
  .object({
    expectedVersion: z
      .number({ required_error: "expectedVersion is required" })
      .int("expectedVersion must be an integer")
      .positive("expectedVersion must be a positive integer"),
  })
  .strict();

export const listKnowledgeSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["DRAFT", "ACTIVE", "RETIRED"]).optional(),
    authority: z.enum(["CONFIRMED", "PROVISIONAL"]).optional(),
    scope: z.enum(["DIOCESE", "PARISH"]).optional(),
    parishId: z.coerce.number().int().positive().optional(),
    category: z.string().max(100).optional(),
    search: z.string().max(100).optional(),
  })
  .strict();
