import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { WorkspaceRole } from "../../members/member.schema";

export type WorkspaceMemberCtx = { workspaceId: string; role: WorkspaceRole };

export const CurrentMember = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): WorkspaceMemberCtx => {
    const req = ctx.switchToHttp().getRequest();
    return req.member as WorkspaceMemberCtx;
  }
);
