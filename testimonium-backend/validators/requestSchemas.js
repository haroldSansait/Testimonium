import { z } from "zod";
import { DocumentType, DocumentRequestStatus, DocumentReturnReasonCode } from "../shared/constants.js";

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
  applicantFirstName: z.string().max(50, "Applicant first name must not exceed 50 characters").optional().nullable(),
  applicantMiddleName: z.string().max(50, "Applicant middle name must not exceed 50 characters").optional().nullable(),
  applicantLastName: z.string().max(50, "Applicant last name must not exceed 50 characters").optional().nullable(),
  applicantName: z.string().max(150, "Applicant name must not exceed 150 characters").optional().nullable(),
  relationship: z.string().max(100, "Relationship must not exceed 100 characters").optional().nullable(),
  purpose: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const hasStructured = Boolean(
    typeof data.applicantFirstName === "string" &&
    data.applicantFirstName.trim().length > 0 &&
    typeof data.applicantLastName === "string" &&
    data.applicantLastName.trim().length > 0
  );
  const hasLegacy = Boolean(
    typeof data.applicantName === "string" &&
    data.applicantName.trim().length > 0
  );

  if (!hasStructured && !hasLegacy) {
    if (!data.applicantFirstName || !data.applicantFirstName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Applicant first name is required",
        path: ["applicantFirstName"],
      });
    }
    if (!data.applicantLastName || !data.applicantLastName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Applicant last name is required",
        path: ["applicantLastName"],
      });
    }
  }

  if (hasStructured) {
    const combined = [
      data.applicantFirstName?.trim(),
      data.applicantMiddleName?.trim(),
      data.applicantLastName?.trim(),
    ].filter(Boolean).join(" ");

    if (combined.length > 150) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Combined applicant name must not exceed 150 characters",
        path: ["applicantFirstName"],
      });
    }
  }
});

// Strict allowlist: draft editing cannot change identity, fees or workflow state.
export const updateDraftSchema = z.object({
  applicantName: z.string().trim().min(1, "Applicant name is required").max(150).optional(),
  applicantFirstName: createRequestSchema.shape.applicantFirstName,
  applicantMiddleName: createRequestSchema.shape.applicantMiddleName,
  applicantLastName: createRequestSchema.shape.applicantLastName,
  relationship: z.string().trim().min(1).max(100).optional(),
  purpose: z.string().nullable().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, "Provide draft details to update")
  .superRefine((data, ctx) => {
    const hasNameParts = [data.applicantFirstName, data.applicantMiddleName, data.applicantLastName].some(value => value !== undefined);
    if (!hasNameParts) return;
    for (const field of ["applicantFirstName", "applicantLastName"]) {
      if (!data[field]?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "First name and last name are required when changing the applicant name" });
    }
    if (data.applicantName !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["applicantName"], message: "Provide separate name fields or a combined name, not both" });
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
  correctionReasonCode: z.enum([
    "UNCLEAR_OR_BLURRY",
    "WRONG_DOCUMENT",
    "INCOMPLETE_DOCUMENT",
    "CROPPED_INFORMATION",
    "APPLICANT_MISMATCH",
    "EXPIRED_OR_INVALID",
    "INCORRECT_REQUIREMENT_FILE",
    "OTHER",
  ]).optional().nullable(),
  correctionNote: z.string().trim().max(1000).optional().nullable(),
}).superRefine((payload, ctx) => {
  if (payload.status === DocumentRequestStatus.RETURNED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "The RETURNED status cannot be manually set by staff. Parishioners must submit a return request.",
    });
    return;
  }
  if (payload.status !== DocumentRequestStatus.NEEDS_CORRECTION) return;
  if (!payload.correctionReasonCode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctionReasonCode"], message: "A valid correction reason is required" });
  }
  if (!payload.correctionRequirementIds?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctionRequirementIds"], message: "At least one requirement must be selected" });
  } else if (new Set(payload.correctionRequirementIds).size !== payload.correctionRequirementIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctionRequirementIds"], message: "Duplicate requirement IDs are not allowed" });
  }
});

export const returnDocumentSchema = z.object({
  reasonCode: z.enum(
    Object.values(DocumentReturnReasonCode),
    {
      errorMap: () => ({
        message: "Invalid return reason code. Must be one of the approved return reasons.",
      }),
    }
  ),
  notes: z.string().trim().max(1000, "Notes cannot exceed 1000 characters").optional().nullable(),
});
