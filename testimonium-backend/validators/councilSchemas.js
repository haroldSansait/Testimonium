import { z } from "zod";

export const councilMemberSchema = z.object({
  positionTitle: z
    .string({
      required_error: "Position / title is required.",
      invalid_type_error: "Position / title must be a string.",
    })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: "Position / title cannot be blank.",
    })
    .refine((val) => val.length <= 200, {
      message: "Position / title must not exceed 200 characters.",
    }),
  memberName: z
    .string({
      required_error: "Member name is required.",
      invalid_type_error: "Member name must be a string.",
    })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: "Member name cannot be blank.",
    })
    .refine((val) => val.length <= 200, {
      message: "Member name must not exceed 200 characters.",
    }),
  sortOrder: z.number().int().nonnegative().optional(),
});

const checkForDuplicates = (members, councilName, ctx) => {
  const seen = new Set();
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const key = `${m.memberName.toLowerCase()}::${m.positionTitle.toLowerCase()}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate member entry "${m.memberName}" with position "${m.positionTitle}" in ${councilName}.`,
        path: [councilName === "Parish Pastoral Council" ? "pastoralCouncilMembers" : "financeCouncilMembers", i],
      });
    }
    seen.add(key);
  }
};

export const saveCouncilSchema = z
  .object({
    expectedVersion: z
      .number({
        required_error: "expectedVersion is required.",
        invalid_type_error: "expectedVersion must be an integer.",
      })
      .int("expectedVersion must be an integer.")
      .positive("expectedVersion must be positive."),
    financeCouncilEnabled: z.boolean({
      required_error: "financeCouncilEnabled is required.",
      invalid_type_error: "financeCouncilEnabled must be a boolean.",
    }),
    pastoralCouncilMembers: z
      .array(councilMemberSchema)
      .max(50, "Pastoral council cannot exceed 50 members.")
      .default([]),
    financeCouncilMembers: z
      .array(councilMemberSchema)
      .max(50, "Finance council cannot exceed 50 members.")
      .default([]),
  })
  .superRefine((data, ctx) => {
    // Check duplicates inside Pastoral Council
    if (data.pastoralCouncilMembers && data.pastoralCouncilMembers.length > 0) {
      checkForDuplicates(data.pastoralCouncilMembers, "Parish Pastoral Council", ctx);
    }

    // Check duplicates inside Finance Council if enabled
    if (data.financeCouncilEnabled) {
      if (!data.financeCouncilMembers || data.financeCouncilMembers.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one Finance Council member is required when the Finance Council is enabled.",
          path: ["financeCouncilMembers"],
        });
      } else {
        checkForDuplicates(data.financeCouncilMembers, "Parish Finance Council", ctx);
      }
    }
  });
