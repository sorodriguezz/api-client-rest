import { Schema, Document } from "mongoose";

export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type MemberDoc = Document & {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
};

export const WorkspaceMemberSchema = new Schema<MemberDoc>(
  {
    workspaceId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: {
      type: String,
      required: true,
      enum: ["OWNER", "ADMIN", "EDITOR", "VIEWER"],
      default: "EDITOR",
    },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "workspace_members" }
);

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
