import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { MemberDoc, WorkspaceRole } from "../../members/member.schema";

const ROLE_ORDER: WorkspaceRole[] = ["VIEWER", "EDITOR", "ADMIN", "OWNER"];
const atLeast = (cur: WorkspaceRole, req: WorkspaceRole) =>
  ROLE_ORDER.indexOf(cur) >= ROLE_ORDER.indexOf(req);

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    @InjectModel("WorkspaceMember") private memberModel: Model<MemberDoc>,
    private required: WorkspaceRole
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { userId: string };
    const workspaceId = req.params.workspaceId || req.body?.workspaceId;

    if (!workspaceId) return false;

    const member = await this.memberModel
      .findOne({ workspaceId, userId: user.userId })
      .lean();

    if (!member) return false;
    if (!atLeast(member.role, this.required)) return false;

    req.member = { workspaceId, role: member.role };
    return true;
  }
}

export function WorkspaceRoleAtLeast(required: WorkspaceRole) {
  @Injectable()
  class Guard extends WorkspaceRoleGuard {
    constructor(@InjectModel("WorkspaceMember") memberModel: Model<MemberDoc>) {
      super(memberModel, required);
    }
  }
  return Guard;
}
