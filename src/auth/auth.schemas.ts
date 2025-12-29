import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string(),
  password: z.string().min(1).max(200),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const RegisterSchema = LoginSchema.extend({
  name: z.string().min(1).max(120).optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
