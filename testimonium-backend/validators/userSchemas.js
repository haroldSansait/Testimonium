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
