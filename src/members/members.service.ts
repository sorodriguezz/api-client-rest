import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { MemberDoc, WorkspaceRole } from "./member.schema";
import type { UserDoc } from "../users/user.schema";

@Injectable()
export class MembersService {
  constructor(
    @InjectModel("WorkspaceMember") private memModel: Model<MemberDoc>,
    @InjectModel("User") private userModel: Model<UserDoc>
  ) {}

  async list(workspaceId: string) {
    const members = await this.memModel.find({ workspaceId }).lean();
    const userIds = members.map((m) => m.userId);
    const users = await this.userModel.find({ _id: { $in: userIds } }).lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    return members.map((m) => ({
      userId: m.userId,
      email: byId.get(m.userId)?.email ?? "(deleted)",
      name: byId.get(m.userId)?.name ?? null,
      role: m.role,
    }));
  }

  async invite(workspaceId: string, email: string, role: WorkspaceRole) {
    const user = await this.userModel.findOne({ email }).lean();
    if (!user) throw new NotFoundException({ error: "user_not_found" });

    const userId = String(user._id);
    // upsert
    const updated = await this.memModel.findOneAndUpdate(
      { workspaceId, userId },
      { $set: { role } },
      { upsert: true, new: true }
    );

    return { workspaceId, userId, role: updated.role };
  }

  async updateRole(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    role: WorkspaceRole
  ) {
    const actor = await this.memModel
      .findOne({ workspaceId, userId: actorId })
      .lean();
    if (!actor) throw new ForbiddenException({ error: "forbidden" });

    const target = await this.memModel
      .findOne({ workspaceId, userId: targetUserId })
      .lean();
    if (!target) throw new NotFoundException({ error: "member_not_found" });

    const actorIsOwner = actor.role === "OWNER";
    if (!actorIsOwner && (role === "OWNER" || target.role === "OWNER")) {
      throw new ForbiddenException({ error: "owner_required" });
    }

    if (target.role === "OWNER" && role !== "OWNER") {
      const owners = await this.memModel.countDocuments({
        workspaceId,
        role: "OWNER",
      });
      if (owners <= 1) {
        throw new BadRequestException({ error: "owner_required" });
      }
    }

    await this.memModel.updateOne(
      { workspaceId, userId: targetUserId },
      { $set: { role } }
    );

    return { workspaceId, userId: targetUserId, role };
  }

  async removeMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string
  ) {
    const actor = await this.memModel
      .findOne({ workspaceId, userId: actorId })
      .lean();
    if (!actor) throw new ForbiddenException({ error: "forbidden" });

    const target = await this.memModel
      .findOne({ workspaceId, userId: targetUserId })
      .lean();
    if (!target) throw new NotFoundException({ error: "member_not_found" });

    if (target.role === "OWNER" && actor.role !== "OWNER") {
      throw new ForbiddenException({ error: "owner_required" });
    }

    if (target.role === "OWNER") {
      const owners = await this.memModel.countDocuments({
        workspaceId,
        role: "OWNER",
      });
      if (owners <= 1) {
        throw new BadRequestException({ error: "owner_required" });
      }
    }

    await this.memModel.deleteOne({ workspaceId, userId: targetUserId });
    return { ok: true };
  }

  async leave(workspaceId: string, userId: string) {
    const member = await this.memModel
      .findOne({ workspaceId, userId })
      .lean();
    if (!member) throw new NotFoundException({ error: "member_not_found" });

    if (member.role === "OWNER") {
      const owners = await this.memModel.countDocuments({
        workspaceId,
        role: "OWNER",
      });
      if (owners <= 1) {
        throw new BadRequestException({ error: "owner_required" });
      }
    }

    await this.memModel.deleteOne({ workspaceId, userId });
    return { ok: true };
  }
}
