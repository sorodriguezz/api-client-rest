import { Schema, Document } from "mongoose";

export type NodeType = "FOLDER" | "REQUEST";

export type HeaderKV = { key: string; value: string; enabled?: boolean };
export type QueryKV = { key: string; value: string; enabled?: boolean };

export type RequestSub = {
  method: string;
  urlRaw: string;
  headers: HeaderKV[];
  query: QueryKV[];
  bodyType: string; // none|raw|json|urlencoded|formdata|graphql
  bodyRaw?: string | null;
  bodyUrlEncoded?: QueryKV[];
  bodyFormData?: Array<HeaderKV & { type?: string }>;
  bodyGraphql?: { query: string; variables?: string | null };
  authType: string; // none|bearer|basic|apiKey|oauth2
  auth: any; // { token } etc
};

export type NodeDoc = Document & {
  workspaceId: string;
  parentId?: string | null;
  type: NodeType;
  name: string;
  sortOrder: number;
  version: number;
  updatedAt: Date;
  updatedBy?: string | null;
  request?: RequestSub | null;
};

const RequestSubSchema = new Schema<RequestSub>(
  {
    method: { type: String, required: true, default: "GET" },
    urlRaw: { type: String, default: "" },
    headers: [{ type: Array, default: [] }],
    query: [{ type: Array, default: [] }],
    bodyType: { type: String, required: true, default: "none" },
    bodyRaw: { type: String, default: null },
    bodyUrlEncoded: { type: Array, default: [] },
    bodyFormData: { type: Array, default: [] },
    bodyGraphql: {
      type: new Schema(
        {
          query: { type: String, default: "" },
          variables: { type: String, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    authType: { type: String, required: true, default: "none" },
    auth: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

export const NodeSchema = new Schema<NodeDoc>(
  {
    workspaceId: { type: String, required: true, index: true },
    parentId: { type: String, default: null, index: true },
    type: { type: String, required: true, enum: ["FOLDER", "REQUEST"] },
    name: { type: String, required: true },
    sortOrder: { type: Number, required: true, default: 0 },

    version: { type: Number, required: true, default: 1 },
    updatedAt: { type: Date, default: () => new Date() },
    updatedBy: { type: String, default: null },

    request: { type: RequestSubSchema, default: null },
  },
  { collection: "nodes" }
);

NodeSchema.index({ workspaceId: 1, parentId: 1 });
