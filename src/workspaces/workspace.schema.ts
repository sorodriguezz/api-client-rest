import { Schema, Document } from "mongoose";

export type WorkspaceDoc = Document & {
  name: string;
  createdAt: Date;
};

export const WorkspaceSchema = new Schema<WorkspaceDoc>(
  {
    name: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "workspaces" }
);
