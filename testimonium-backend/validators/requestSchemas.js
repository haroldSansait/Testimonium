import { z } from "zod";

export const createRequestSchema = z.object({
  parishId: z.coerce.number().int().positive("Parish ID must be a positive integer"),
  documentType: z.enum(
    [
      "BAPTISMAL_CERTIFICATE",
      "CONFIRMATION_CERTIFICATE",
      "MARRIAGE_CERTIFICATE",
      "FIRST_COMMUNION_CERTIFICATE",
    ],
    {
      errorMap: () => ({
        message:
          "Document type must be one of: BAPTISMAL_CERTIFICATE, CONFIRMATION_CERTIFICATE, MARRIAGE_CERTIFICATE, FIRST_COMMUNION_CERTIFICATE",
      }),
    }
  ),
  applicantName: z
    .string({
      required_error: "Applicant name is required",
    })
    .min(1, "Applicant name cannot be empty"),
  relationship: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(
    [
      "PENDING",
      "UNDER_REVIEW",
      "PAYMENT_PENDING",
      "PAYMENT_VERIFIED",
      "PROCESSING",
      "READY_FOR_PICKUP",
      "COMPLETED",
      "REJECTED",
      "CANCELLED",
    ],
    {
      errorMap: () => ({
        message: "Invalid status value",
      }),
    }
  ),
  remarks: z.string().optional().nullable(),
});
