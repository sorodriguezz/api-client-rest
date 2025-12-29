import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WorkspaceRoleAtLeast } from "../common/guards/workspace-role.guard";
import { CurrentUser } from "../common/decorators/user.decorator";
import { MembersService } from "./members.service";

@Controller("workspaces/:workspaceId")
@UseGuards(JwtAuthGuard)
export class WorkspaceMembersController {
  constructor(private members: MembersService) {}

  @Post("leave")
  @UseGuards(WorkspaceRoleAtLeast("VIEWER"))
  leave(
    @CurrentUser() user: any,
    @Param("workspaceId") workspaceId: string
  ) {
    return this.members.leave(workspaceId, user.userId);
  }
}
