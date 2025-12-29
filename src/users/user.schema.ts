import { Schema, Document } from "mongoose";

export type UserDoc = Document & {
  email: string;
  name?: string | null;
  passwordHash: string;
  createdAt: Date;
};

export const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: null },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "users" }
);
