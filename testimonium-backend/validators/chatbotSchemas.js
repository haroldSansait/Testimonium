import { z } from "zod";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const chatbotQuerySchema = z
  .object({
    question: z
      .string({
        required_error: "Question is required",
        invalid_type_error: "Question must be a string",
      })
      .transform((val) =>
        val
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .refine((val) => val.length >= 1, {
        message: "Question must contain at least 1 non-whitespace character",
      })
      .refine((val) => val.length <= 1000, {
        message: "Question must not exceed 1000 characters",
      }),
    sessionId: z
      .string()
      .regex(UUID_REGEX, "Session ID must be a valid UUID")
      .optional()
      .nullable(),
    selectedParishId: z
      .number({ invalid_type_error: "selectedParishId must be a positive integer" })
      .int("selectedParishId must be an integer")
      .positive("selectedParishId must be a positive integer")
      .optional()
      .nullable(),
  })
  .strict({
    message: "Unknown fields are not allowed in chatbot query payload",
  });
