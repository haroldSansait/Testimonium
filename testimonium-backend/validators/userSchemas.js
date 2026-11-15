import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string({
    required_error: "Full name is required",
  }).min(1, "Full name must be at least 1 character"),
  email: z.string({
    required_error: "Email is required",
  }).email("Invalid email format"),
  role: z.enum(["DIOCESE_COORDINATOR", "PRIEST", "SECRETARY", "ASSISTANT_PRIEST"], {
    errorMap: () => ({ message: "Role must be one of: DIOCESE_COORDINATOR, PRIEST, SECRETARY, ASSISTANT_PRIEST" }),
  }),
  parish: z.string().optional().nullable(),
});

export const updateUserSchema = createUserSchema.partial();

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string({
        required_error: "New password is required",
      })
      .min(8, "Password must be at least 8 characters long")
      .max(128, "Password must be at most 128 characters long"),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => data.confirmPassword === undefined || data.newPassword === data.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }
  );
