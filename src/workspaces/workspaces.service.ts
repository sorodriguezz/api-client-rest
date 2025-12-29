import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { WorkspaceDoc } from "./workspace.schema";
import { MemberDoc } from "../members/member.schema";
import { NodeDoc } from "../nodes/node.schema";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel("Workspace") private wsModel: Model<WorkspaceDoc>,
    @InjectModel("WorkspaceMember") private memModel: Model<MemberDoc>,
    @InjectModel("Node") private nodeModel: Model<NodeDoc>,
    private rt: RealtimeService
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.memModel.find({ userId }).lean();
    const workspaceIds = memberships.map((m) => m.workspaceId);
    const workspaces = await this.wsModel
      .find({ _id: { $in: workspaceIds } })
      .lean();

    const wsById = new Map(workspaces.map((w) => [String(w._id), w]));
    return memberships
      .map((m) => ({
        id: m.workspaceId,
        name: wsById.get(m.workspaceId)?.name ?? "(deleted)",
        role: m.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(userId: string, name: string) {
    const ws = await this.wsModel.create({ name });
    const wsId = String(ws._id);

    await this.memModel.create({ workspaceId: wsId, userId, role: "OWNER" });

    // Root folder
    await this.nodeModel.create({
      workspaceId: wsId,
      parentId: null,
      type: "FOLDER",
      name: "Root",
      sortOrder: 0,
      version: 1,
      updatedBy: userId,
      updatedAt: new Date(),
      request: null,
    });

    return { id: wsId, name: ws.name };
  }

  async update(workspaceId: string, name: string) {
    const updated = await this.wsModel.findByIdAndUpdate(
      workspaceId,
      { $set: { name } },
      { new: true }
    );

    if (!updated) throw new NotFoundException({ error: "not_found" });

    this.rt.publish({
      type: "workspace.updated",
      workspaceId: String(updated._id),
      name: updated.name,
    });
    return { ok: true, id: String(updated._id), name: updated.name };
  }

  async remove(workspaceId: string) {
    const existing = await this.wsModel.findById(workspaceId).lean();
    if (!existing) throw new NotFoundException({ error: "not_found" });

    await this.memModel.deleteMany({ workspaceId });
    await this.nodeModel.deleteMany({ workspaceId });
    await this.wsModel.deleteOne({ _id: workspaceId });

    this.rt.publish({ type: "workspace.deleted", workspaceId });
    return { ok: true };
  }
}
