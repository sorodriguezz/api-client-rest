import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NodeDoc } from "./node.schema";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class NodesService {
  constructor(
    @InjectModel("Node") private nodeModel: Model<NodeDoc>,
    private rt: RealtimeService
  ) {}

  private async nextSortOrder(
    workspaceId: string,
    parentId: string | null
  ) {
    const last = await this.nodeModel
      .find({ workspaceId, parentId })
      .sort({ sortOrder: -1 })
      .select("sortOrder")
      .limit(1)
      .lean();
    return (last[0]?.sortOrder ?? -1) + 1;
  }

  private cloneRequestSub(req: any, includeAuth = true) {
    if (!req) return null;
    const cloned = JSON.parse(JSON.stringify(req));
    if (!includeAuth) {
      cloned.authType = "none";
      cloned.auth = {};
    }
    return cloned;
  }

  private async ensureFolder(
    workspaceId: string,
    nodeId: string | null | undefined
  ) {
    if (!nodeId) return;
    const parent = await this.nodeModel
      .findOne({ _id: nodeId, workspaceId, type: "FOLDER" })
      .select("_id")
      .lean();
    if (!parent) throw new BadRequestException({ error: "invalid_parent" });
  }

  async tree(workspaceId: string) {
    const nodes = await this.nodeModel
      .find({ workspaceId })
      .sort({ parentId: 1, sortOrder: 1, name: 1 })
      .lean();

    return nodes.map((n) => ({
      id: String(n._id),
      parentId: n.parentId ?? null,
      type: n.type,
      name: n.name,
      sortOrder: n.sortOrder,
      version: n.version,
      method: n.type === "REQUEST" ? n.request?.method ?? null : null,
      urlRaw: n.type === "REQUEST" ? n.request?.urlRaw ?? null : null,
    }));
  }

  async create(userId: string, dto: any) {
    const node = await this.nodeModel.create({
      workspaceId: dto.workspaceId,
      parentId: dto.parentId ?? null,
      type: dto.type,
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
      version: 1,
      updatedBy: userId,
      updatedAt: new Date(),
      request:
        dto.type === "REQUEST"
          ? {
              method: "GET",
              urlRaw: "",
              headers: [],
              query: [],
              bodyType: "none",
              bodyRaw: null,
              bodyUrlEncoded: [],
              bodyFormData: [],
              bodyGraphql: null,
              authType: "none",
              auth: {},
            }
          : null,
    });

    this.rt.publish({
      type: "node.created",
      workspaceId: node.workspaceId,
      nodeId: String(node._id),
    });
    return { id: String(node._id) };
  }

  async patch(
    userId: string,
    nodeId: string,
    dto: any,
    workspaceId?: string
  ) {
    const updated = await this.nodeModel.findOneAndUpdate(
      { _id: nodeId, ...(workspaceId ? { workspaceId } : {}) },
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          updatedBy: userId,
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updated) throw new NotFoundException({ error: "not_found" });
    this.rt.publish({
      type: "node.updated",
      workspaceId: updated.workspaceId,
      nodeId: String(updated._id),
    });
    return { ok: true };
  }

  async remove(nodeId: string, workspaceId?: string) {
    const existing = await this.nodeModel
      .findOne({ _id: nodeId, ...(workspaceId ? { workspaceId } : {}) })
      .lean();
    if (!existing) throw new NotFoundException({ error: "not_found" });

    // delete cascade manual: borrar todos los descendientes
    // MVP simple: borrar por workspaceId y path parentId recursivo (loop).
    const toDelete = [String(existing._id)];
    for (let i = 0; i < toDelete.length; i++) {
      const pid = toDelete[i];
      const children = await this.nodeModel
        .find({
          parentId: pid,
          ...(workspaceId ? { workspaceId } : {}),
        })
        .select("_id")
        .lean();
      for (const c of children) toDelete.push(String(c._id));
    }
    await this.nodeModel.deleteMany({ _id: { $in: toDelete } });

    this.rt.publish({
      type: "node.deleted",
      workspaceId: existing.workspaceId,
      nodeId: String(existing._id),
    });
    return { ok: true, deleted: toDelete.length };
  }

  async getRequest(workspaceId: string, nodeId: string) {
    const node = await this.nodeModel
      .findOne({ _id: nodeId, workspaceId, type: "REQUEST" })
      .lean();
    if (!node) throw new NotFoundException({ error: "not_found" });

    return {
      id: String(node._id),
      name: node.name,
      version: node.version,
      request: node.request,
    };
  }

  async updateRequest(
    userId: string,
    workspaceId: string,
    nodeId: string,
    dto: any
  ) {
    const request = {
      method: dto.method,
      urlRaw: dto.urlRaw,
      headers: dto.headers ?? [],
      query: dto.query ?? [],
      bodyType: dto.bodyType,
      bodyRaw: dto.bodyRaw ?? null,
      bodyUrlEncoded: dto.bodyUrlEncoded ?? [],
      bodyFormData: dto.bodyFormData ?? [],
      bodyGraphql: dto.bodyGraphql ?? null,
      authType: dto.authType,
      auth: dto.auth ?? {},
    };

    if (request.bodyType !== "urlencoded") request.bodyUrlEncoded = [];
    if (request.bodyType !== "formdata") request.bodyFormData = [];
    if (request.bodyType !== "graphql") request.bodyGraphql = null;
    if (request.bodyType === "none") request.bodyRaw = null;

    const updated = await this.nodeModel.findOneAndUpdate(
      { _id: nodeId, workspaceId, type: "REQUEST", version: dto.version },
      {
        $set: {
          request,
          updatedBy: userId,
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updated) {
      const existing = await this.nodeModel
        .findOne({ _id: nodeId, workspaceId, type: "REQUEST" })
        .select("version")
        .lean();
      if (!existing) throw new NotFoundException({ error: "not_found" });
      throw new ConflictException({
        error: "version_mismatch",
        currentVersion: existing.version,
      });
    }

    this.rt.publish({
      type: "request.updated",
      workspaceId,
      nodeId: String(updated._id),
    });
    return { ok: true, version: updated.version };
  }

  async removeRequest(workspaceId: string, nodeId: string) {
    return this.remove(nodeId, workspaceId);
  }

  async cloneRequest(
    userId: string,
    workspaceId: string,
    nodeId: string,
    dto: any
  ) {
    const node = await this.nodeModel
      .findOne({ _id: nodeId, workspaceId, type: "REQUEST" })
      .lean();
    if (!node?.request) throw new NotFoundException({ error: "not_found" });

    const parentId = dto.targetParentId ?? node.parentId ?? null;
    await this.ensureFolder(workspaceId, parentId);

    const sortOrder = await this.nextSortOrder(workspaceId, parentId);
    const cloned = await this.nodeModel.create({
      workspaceId,
      parentId,
      type: "REQUEST",
      name: dto.name ?? node.name,
      sortOrder,
      version: 1,
      updatedBy: userId,
      updatedAt: new Date(),
      request: this.cloneRequestSub(node.request, dto.includeAuth !== false),
    });

    this.rt.publish({
      type: "node.created",
      workspaceId,
      nodeId: String(cloned._id),
    });
    return { id: String(cloned._id) };
  }

  async cloneTree(
    userId: string,
    workspaceId: string,
    nodeId: string,
    dto: any
  ) {
    const root = await this.nodeModel
      .findOne({ _id: nodeId, workspaceId, type: "FOLDER" })
      .lean();
    if (!root) throw new NotFoundException({ error: "not_found" });

    await this.ensureFolder(workspaceId, dto.targetParentId);

    const rootSortOrder = await this.nextSortOrder(
      workspaceId,
      dto.targetParentId ?? null
    );

    if (dto.mode === "shallow") {
      const shallow = await this.nodeModel.create({
        workspaceId,
        parentId: dto.targetParentId ?? null,
        type: "FOLDER",
        name: dto.name ?? root.name,
        sortOrder: rootSortOrder,
        version: 1,
        updatedBy: userId,
        updatedAt: new Date(),
        request: null,
      });

      this.rt.publish({
        type: "tree.cloned",
        workspaceId,
        rootId: String(shallow._id),
        count: 1,
      });
      return { rootId: String(shallow._id), count: 1 };
    }

    const nodes = await this.nodeModel.find({ workspaceId }).lean();
    const byParent = new Map<string | null, NodeDoc[]>();
    for (const n of nodes) {
      const key = n.parentId ?? null;
      const arr = byParent.get(key) ?? [];
      arr.push(n);
      byParent.set(key, arr);
    }

    const queue: NodeDoc[] = [root];
    const ordered: NodeDoc[] = [];
    while (queue.length) {
      const cur = queue.shift() as NodeDoc;
      ordered.push(cur);
      const children = byParent.get(String(cur._id)) ?? [];
      for (const child of children) queue.push(child);
    }

    const map = new Map<string, string>();
    const rootClone = await this.nodeModel.create({
      workspaceId,
      parentId: dto.targetParentId ?? null,
      type: "FOLDER",
      name: dto.name ?? root.name,
      sortOrder: rootSortOrder,
      version: 1,
      updatedBy: userId,
      updatedAt: new Date(),
      request: null,
    });
    map.set(String(root._id), String(rootClone._id));

    for (const node of ordered) {
      const oldId = String(node._id);
      if (oldId === String(root._id)) continue;

      const parentKey = node.parentId ? String(node.parentId) : null;
      const newParentId = parentKey ? map.get(parentKey) ?? null : null;
      const created = await this.nodeModel.create({
        workspaceId,
        parentId: newParentId,
        type: node.type,
        name: node.name,
        sortOrder: node.sortOrder,
        version: 1,
        updatedBy: userId,
        updatedAt: new Date(),
        request:
          node.type === "REQUEST"
            ? this.cloneRequestSub(node.request, true)
            : null,
      });
      map.set(oldId, String(created._id));
    }

    this.rt.publish({
      type: "tree.cloned",
      workspaceId,
      rootId: String(rootClone._id),
      count: map.size,
    });
    return { rootId: String(rootClone._id), count: map.size };
  }
}
