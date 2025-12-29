import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WorkspaceRoleAtLeast } from "../common/guards/workspace-role.guard";
import { ZodPipe } from "../common/zod.pipe";
import { CurrentUser } from "../common/decorators/user.decorator";
import { InviteMemberSchema, UpdateMemberRoleSchema } from "./members.schemas";
import { MembersService } from "./members.service";

@Controller("workspaces/:workspaceId/members")
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private members: MembersService) {}

  @Get()
  @UseGuards(WorkspaceRoleAtLeast("VIEWER"))
  list(@Param("workspaceId") workspaceId: string) {
    return this.members.list(workspaceId);
  }

  @Post("invite")
  @UseGuards(WorkspaceRoleAtLeast("ADMIN"))
  invite(
    @Param("workspaceId") workspaceId: string,
    @Body(new ZodPipe(InviteMemberSchema)) body: any
  ) {
    return this.members.invite(workspaceId, body.email, body.role);
  }

  @Patch(":userId")
  @UseGuards(WorkspaceRoleAtLeast("ADMIN"))
  updateRole(
    @CurrentUser() user: any,
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string,
    @Body(new ZodPipe(UpdateMemberRoleSchema)) body: any
  ) {
    return this.members.updateRole(
      workspaceId,
      user.userId,
      userId,
      body.role
    );
  }

  @Delete(":userId")
  @UseGuards(WorkspaceRoleAtLeast("ADMIN"))
  removeMember(
    @CurrentUser() user: any,
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string
  ) {
    return this.members.removeMember(workspaceId, user.userId, userId);
  }
}
