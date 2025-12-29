import { z } from "zod";

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]).default("EDITOR"),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
});
