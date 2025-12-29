import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RealtimeService } from "../realtime/realtime.service";

import { NodeDoc } from "../nodes/node.schema";
import { WorkspaceDoc } from "../workspaces/workspace.schema";
import { z } from "zod";

const PostmanCollectionSchema = z.object({
  info: z.any().optional(),
  item: z.array(z.any()),
});

/** Helpers para normalizar URL/headers/query */
function getUrlRaw(pmUrl: any): string {
  if (!pmUrl) return "";
  if (typeof pmUrl === "string") return pmUrl;
  if (typeof pmUrl.raw === "string") return pmUrl.raw;

  const host = Array.isArray(pmUrl.host) ? pmUrl.host.join(".") : "";
  const path = Array.isArray(pmUrl.path) ? "/" + pmUrl.path.join("/") : "";
  const protocol = pmUrl.protocol ? `${pmUrl.protocol}://` : "";
  return `${protocol}${host}${path}`;
}

function mapHeaders(pmHeaders: any) {
  if (!Array.isArray(pmHeaders)) return [];
  return pmHeaders
    .filter((h) => h && typeof h.key === "string")
    .map((h) => ({
      key: String(h.key),
      value: String(h.value ?? ""),
      enabled: h.disabled ? false : true,
    }));
}

function mapQuery(pmUrl: any) {
  if (!pmUrl || typeof pmUrl === "string") return [];
  const q = pmUrl.query;
  if (!Array.isArray(q)) return [];
  return q
    .filter((x) => x && typeof x.key === "string")
    .map((x) => ({
      key: String(x.key),
      value: String(x.value ?? ""),
      enabled: x.disabled ? false : true,
    }));
}

function authArrayToObj(items: any) {
  if (!Array.isArray(items)) return {};
  const out: Record<string, string> = {};
  for (const it of items) {
    if (!it || typeof it.key !== "string") continue;
    out[it.key] = String(it.value ?? "");
  }
  return out;
}

function mapAuth(pmAuth: any) {
  if (!pmAuth || pmAuth.type === "noauth") {
    return { authType: "none", auth: {} };
  }

  const type = String(pmAuth.type || "").toLowerCase();
  if (type === "bearer") {
    const data = authArrayToObj(pmAuth.bearer);
    return { authType: "bearer", auth: { token: data.token ?? "" } };
  }
  if (type === "basic") {
    const data = authArrayToObj(pmAuth.basic);
    return {
      authType: "basic",
      auth: { username: data.username ?? "", password: data.password ?? "" },
    };
  }
  if (type === "apikey") {
    const data = authArrayToObj(pmAuth.apikey);
    return {
      authType: "apiKey",
      auth: { key: data.key ?? "", value: data.value ?? "", in: data.in ?? "" },
    };
  }
  if (type === "oauth2") {
    const data = authArrayToObj(pmAuth.oauth2);
    return { authType: "oauth2", auth: data };
  }

  return { authType: "none", auth: {} };
}

function mapFormItems(items: any) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((x) => x && typeof x.key === "string")
    .map((x) => ({
      key: String(x.key),
      value: String(x.value ?? x.src ?? ""),
      enabled: x.disabled ? false : true,
      type: x.type ? String(x.type) : undefined,
    }));
}

function mapBody(pmReq: any) {
  const body = pmReq?.body;
  let bodyType = "none";
  let bodyRaw: string | null = null;
  let bodyUrlEncoded: any[] = [];
  let bodyFormData: any[] = [];
  let bodyGraphql: { query: string; variables?: string | null } | null = null;

  if (!body) {
    return { bodyType, bodyRaw, bodyUrlEncoded, bodyFormData, bodyGraphql };
  }

  if (body.mode === "raw") {
    const raw = typeof body.raw === "string" ? body.raw : "";
    const lang = body.options?.raw?.language;
    bodyType = lang === "json" ? "json" : "raw";
    bodyRaw = raw;
  } else if (body.mode === "urlencoded") {
    bodyType = "urlencoded";
    bodyUrlEncoded = mapFormItems(body.urlencoded);
  } else if (body.mode === "formdata") {
    bodyType = "formdata";
    bodyFormData = mapFormItems(body.formdata);
  } else if (body.mode === "graphql") {
    bodyType = "graphql";
    bodyGraphql = {
      query: String(body.graphql?.query ?? ""),
      variables:
        body.graphql?.variables !== undefined
          ? String(body.graphql.variables)
          : null,
    };
  }

  return { bodyType, bodyRaw, bodyUrlEncoded, bodyFormData, bodyGraphql };
}

function countItems(items: any[]): number {
  let count = 0;
  for (const it of items || []) {
    if (Array.isArray(it?.item)) {
      count += 1;
      count += countItems(it.item);
      continue;
    }
    if (it?.request) count += 1;
  }
  return count;
}

function toPostmanAuth(authType: string | undefined, auth: any) {
  if (!authType || authType === "none") return null;
  if (authType === "bearer") {
    return {
      type: "bearer",
      bearer: [{ key: "token", value: String(auth?.token ?? "") }],
    };
  }
  if (authType === "basic") {
    return {
      type: "basic",
      basic: [
        { key: "username", value: String(auth?.username ?? "") },
        { key: "password", value: String(auth?.password ?? "") },
      ],
    };
  }
  if (authType === "apiKey") {
    return {
      type: "apikey",
      apikey: [
        { key: "key", value: String(auth?.key ?? "") },
        { key: "value", value: String(auth?.value ?? "") },
        { key: "in", value: String(auth?.in ?? "") },
      ],
    };
  }
  if (authType === "oauth2") {
    const entries = Object.entries(auth ?? {}).map(([key, value]) => ({
      key,
      value: String(value ?? ""),
    }));
    return { type: "oauth2", oauth2: entries };
  }

  return null;
}

@Injectable()
export class PostmanService {
  constructor(
    @InjectModel("Node") private nodeModel: Model<NodeDoc>,
    @InjectModel("Workspace") private wsModel: Model<WorkspaceDoc>,
    private rt: RealtimeService
  ) {}

  private async ensureRoot(
    workspaceId: string,
    userId: string
  ): Promise<string> {
    let root = await this.nodeModel
      .findOne({ workspaceId, parentId: null, type: "FOLDER" })
      .lean();
    if (!root) {
      const created = await this.nodeModel.create({
        workspaceId,
        parentId: null,
        type: "FOLDER",
        name: "Root",
        sortOrder: 0,
        version: 1,
        updatedBy: userId,
        updatedAt: new Date(),
        request: null,
      });
      this.rt.publish({
        type: "node.created",
        workspaceId,
        nodeId: String(created._id),
      });
      return String(created._id);
    }
    return String(root._id);
  }

  /**
   * Importa Postman v2.1:
   * - Folder (item[]) -> Node FOLDER
   * - Request -> Node REQUEST con subdoc request (method/urlRaw/headers/query/bodyRaw)
   */
  async importCollection(workspaceId: string, userId: string, collection: any) {
    const parsed = PostmanCollectionSchema.safeParse(collection);
    if (!parsed.success)
      throw new BadRequestException({ error: "invalid_postman_collection" });

    const maxItems = Math.max(
      1,
      Number(process.env.POSTMAN_IMPORT_MAX_ITEMS || 2000)
    );
    const totalItems = countItems(parsed.data.item);
    if (totalItems > maxItems) {
      throw new BadRequestException({
        error: "import_too_large",
        maxItems,
      });
    }

    const rootId = await this.ensureRoot(workspaceId, userId);

    const importItems = async (items: any[], parentId: string) => {
      let sort = 0;

      for (const it of items) {
        const isFolder = Array.isArray(it?.item);
        const name = String(it?.name ?? (isFolder ? "Folder" : "Request"));

        if (isFolder) {
          const folder = await this.nodeModel.create({
            workspaceId,
            parentId,
            type: "FOLDER",
            name,
            sortOrder: sort++,
            version: 1,
            updatedBy: userId,
            updatedAt: new Date(),
            request: null,
          });

          this.rt.publish({
            type: "node.created",
            workspaceId,
            nodeId: String(folder._id),
          });
          await importItems(it.item, String(folder._id));
          continue;
        }

        const pmReq = it?.request;
        if (!pmReq) continue;

        const method = String(pmReq.method ?? "GET").toUpperCase();
        const urlRaw = getUrlRaw(pmReq.url);

        const headers = mapHeaders(pmReq.header);
        const query = mapQuery(pmReq.url);

        const { authType, auth } = mapAuth(pmReq.auth);
        const {
          bodyType,
          bodyRaw,
          bodyUrlEncoded,
          bodyFormData,
          bodyGraphql,
        } = mapBody(pmReq);

        const node = await this.nodeModel.create({
          workspaceId,
          parentId,
          type: "REQUEST",
          name,
          sortOrder: sort++,
          version: 1,
          updatedBy: userId,
          updatedAt: new Date(),
          request: {
            method,
            urlRaw,
            headers,
            query,
            bodyType,
            bodyRaw,
            bodyUrlEncoded,
            bodyFormData,
            bodyGraphql,
            authType,
            auth,
          },
        });

        this.rt.publish({
          type: "node.created",
          workspaceId,
          nodeId: String(node._id),
        });
      }
    };

    await importItems(parsed.data.item, rootId);
    return { ok: true };
  }

  /**
   * Exporta a Postman v2.1
   * - Reconstituye árbol usando parentId
   */
  async exportCollection(workspaceId: string) {
    const schemaUrl =
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

    const ws = await this.wsModel.findById(workspaceId).lean();
    const name = ws?.name ?? `Workspace ${workspaceId}`;

    const nodes = await this.nodeModel
      .find({ workspaceId })
      .sort({ parentId: 1, sortOrder: 1, name: 1 })
      .lean();

    const byParent = new Map<string | null, any[]>();
    for (const n of nodes) {
      const key = n.parentId ?? null;
      const arr = byParent.get(key) ?? [];
      arr.push(n);
      byParent.set(key, arr);
    }

    const build = (parentId: string | null): any[] => {
      const arr = byParent.get(parentId) ?? [];

      return arr.map((n) => {
        if (n.type === "FOLDER") {
          return { name: n.name, item: build(String(n._id)) };
        }

        const headers = (n.request?.headers ?? []).map((h: any) => ({
          key: String(h.key ?? ""),
          value: String(h.value ?? ""),
          disabled: h.enabled === false ? true : undefined,
        }));

        const url: any = { raw: n.request?.urlRaw ?? "" };

        const q = (n.request?.query ?? []).map((x: any) => ({
          key: String(x.key ?? ""),
          value: String(x.value ?? ""),
          disabled: x.enabled === false ? true : undefined,
        }));
        if (q.length) url.query = q;

        const out: any = {
          name: n.name,
          request: {
            method: n.request?.method ?? "GET",
            header: headers,
            url,
          },
          response: [],
        };

        const auth = toPostmanAuth(n.request?.authType, n.request?.auth);
        if (auth) out.request.auth = auth;

        if (n.request?.bodyType === "raw" || n.request?.bodyType === "json") {
          out.request.body = { mode: "raw", raw: n.request?.bodyRaw ?? "" };
          if (n.request?.bodyType === "json") {
            out.request.body.options = { raw: { language: "json" } };
          }
        }

        if (n.request?.bodyType === "urlencoded") {
          const urlencoded = (n.request?.bodyUrlEncoded ?? []).map(
            (f: any) => ({
              key: String(f.key ?? ""),
              value: String(f.value ?? ""),
              disabled: f.enabled === false ? true : undefined,
              type: f.type ? String(f.type) : undefined,
            })
          );
          out.request.body = { mode: "urlencoded", urlencoded };
        }

        if (n.request?.bodyType === "formdata") {
          const formdata = (n.request?.bodyFormData ?? []).map((f: any) => ({
            key: String(f.key ?? ""),
            value: String(f.value ?? ""),
            disabled: f.enabled === false ? true : undefined,
            type: f.type ? String(f.type) : undefined,
          }));
          out.request.body = { mode: "formdata", formdata };
        }

        if (n.request?.bodyType === "graphql") {
          out.request.body = {
            mode: "graphql",
            graphql: {
              query: String(n.request?.bodyGraphql?.query ?? ""),
              variables: String(n.request?.bodyGraphql?.variables ?? ""),
            },
          };
        }

        return out;
      });
    };

    return {
      info: { name, schema: schemaUrl },
      item: build(null),
    };
  }
}
