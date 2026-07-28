import { z } from "zod";
import { DocumentType, DocumentRequestStatus } from "../shared/constants.js";

export const createRequestSchema = z.object({
  parishId: z.coerce.number().int().positive("Parish ID must be a positive integer"),
  documentType: z.enum(
    Object.values(DocumentType),
    {
      errorMap: () => ({
        message:
          "Document type must be one of the official sacramental document types.",
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
    Object.values(DocumentRequestStatus),
    {
      errorMap: () => ({
        message: "Invalid status value",
      }),
    }
  ),
  remarks: z.string().optional().nullable(),
  correctionRequirementIds: z.array(z.string()).optional().nullable(),
});

