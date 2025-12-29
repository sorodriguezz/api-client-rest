import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserDoc } from "./user.schema";
import { WorkspaceDoc } from "../workspaces/workspace.schema";
import { MemberDoc } from "../members/member.schema";
import { NodeDoc } from "../nodes/node.schema";
import { RealtimeService } from "../realtime/realtime.service";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel("User") private userModel: Model<UserDoc>,
    @InjectModel("Workspace") private wsModel: Model<WorkspaceDoc>,
    @InjectModel("WorkspaceMember") private memModel: Model<MemberDoc>,
    @InjectModel("Node") private nodeModel: Model<NodeDoc>,
    private rt: RealtimeService
  ) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email }).lean();
  }

  private isGlobalAdmin(user: { userId: string; email?: string }) {
    const idList = (process.env.ADMIN_USER_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const emailList = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);

    if (idList.includes(user.userId)) return true;
    if (user.email && emailList.includes(user.email.toLowerCase())) return true;
    return false;
  }

  async deleteUser(
    actor: { userId: string; email?: string },
    targetUserId: string,
    force = false
  ) {
    if (!this.isGlobalAdmin(actor)) {
      throw new ForbiddenException({ error: "admin_required" });
    }

    const user = await this.userModel.findById(targetUserId).lean();
    if (!user) throw new NotFoundException({ error: "user_not_found" });

    const ownerMemberships = await this.memModel
      .find({ userId: targetUserId, role: "OWNER" })
      .lean();

    if (ownerMemberships.length > 0 && !force) {
      throw new BadRequestException({ error: "owner_required" });
    }

    if (force && ownerMemberships.length > 0) {
      const workspaceIds = ownerMemberships.map((m) => m.workspaceId);
      await this.memModel.deleteMany({ workspaceId: { $in: workspaceIds } });
      await this.nodeModel.deleteMany({ workspaceId: { $in: workspaceIds } });
      await this.wsModel.deleteMany({ _id: { $in: workspaceIds } });

      for (const workspaceId of workspaceIds) {
        this.rt.publish({ type: "workspace.deleted", workspaceId });
      }
    }

    await this.memModel.deleteMany({ userId: targetUserId });
    await this.nodeModel.updateMany(
      { updatedBy: targetUserId },
      { $set: { updatedBy: null } }
    );
    await this.userModel.deleteOne({ _id: targetUserId });

    return { ok: true };
  }
}
