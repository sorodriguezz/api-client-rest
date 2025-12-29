import { z } from "zod";

const MAX_BODY_RAW = 1_000_000;

const HeaderKVSchema = z.object({
  key: z.string().max(200).optional().default(""),
  value: z.string().max(10_000).optional().default(""),
  enabled: z.boolean().optional(),
});

const QueryKVSchema = z.object({
  key: z.string().max(200).optional().default(""),
  value: z.string().max(10_000).optional().default(""),
  enabled: z.boolean().optional(),
});

const BodyGraphqlSchema = z.object({
  query: z.string().max(MAX_BODY_RAW).default(""),
  variables: z.string().max(MAX_BODY_RAW).optional().nullable(),
});

const BodyFormItemSchema = z
  .object({
    key: z.string().max(200).optional().default(""),
    value: z.string().max(10_000).optional().default(""),
    enabled: z.boolean().optional(),
    type: z.string().max(50).optional(),
  })
  .passthrough();

export const CreateNodeSchema = z.object({
  workspaceId: z.string().min(1),
  parentId: z.string().nullable(),
  type: z.enum(["FOLDER", "REQUEST"]),
  name: z.string().min(1).max(200),
  sortOrder: z.number().int().optional(),
});

export const PatchNodeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const UpdateRequestSchema = z.object({
  version: z.number().int().min(1),
  method: z.string().min(1).max(10),
  urlRaw: z.string().max(4000),
  headers: z.array(HeaderKVSchema).max(200).default([]),
  query: z.array(QueryKVSchema).max(200).default([]),
  bodyType: z.enum(["none", "raw", "json", "urlencoded", "formdata", "graphql"]),
  bodyRaw: z.string().max(MAX_BODY_RAW).optional().nullable(),
  bodyUrlEncoded: z.array(BodyFormItemSchema).max(200).optional().default([]),
  bodyFormData: z.array(BodyFormItemSchema).max(200).optional().default([]),
  bodyGraphql: BodyGraphqlSchema.optional().nullable(),
  authType: z.enum(["none", "bearer", "basic", "apiKey", "oauth2"]),
  auth: z.record(z.any()).optional().default({}),
});

export const CloneRequestSchema = z.object({
  targetParentId: z.string().min(1).optional(),
  name: z.string().min(1).max(200).optional(),
  includeAuth: z.boolean().optional().default(true),
});

export const CloneTreeSchema = z.object({
  targetParentId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  mode: z.enum(["deep", "shallow"]),
});
