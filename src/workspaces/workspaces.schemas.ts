import { z } from "zod";

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
});

export type RegisterDto = z.infer<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
});

export type UpdateWorkspaceDto = z.infer<typeof UpdateWorkspaceSchema>;
