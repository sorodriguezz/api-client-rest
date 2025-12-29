import { z } from "zod";

export const ExecuteSchema = z.object({
  workspaceId: z.string().min(1),
  nodeId: z.string().min(1),
  timeoutMs: z.number().int().min(500).max(120000).optional(),
});
