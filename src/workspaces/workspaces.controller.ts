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
import { CurrentUser } from "../common/decorators/user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import {
  CreateWorkspaceSchema,
  type RegisterDto,
  UpdateWorkspaceSchema,
  type UpdateWorkspaceDto,
} from "./workspaces.schemas";
import { WorkspacesService } from "./workspaces.service";

@Controller("workspaces")
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private ws: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.ws.listForUser(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: any,
    @Body(new ZodPipe(CreateWorkspaceSchema)) body: RegisterDto
  ) {
    return this.ws.create(user.userId, body.name);
  }

  @Patch(":workspaceId")
  @UseGuards(WorkspaceRoleAtLeast("OWNER"))
  update(
    @Param("workspaceId") workspaceId: string,
    @Body(new ZodPipe(UpdateWorkspaceSchema)) body: UpdateWorkspaceDto
  ) {
    return this.ws.update(workspaceId, body.name);
  }

  @Delete(":workspaceId")
  @UseGuards(WorkspaceRoleAtLeast("OWNER"))
  remove(@Param("workspaceId") workspaceId: string) {
    return this.ws.remove(workspaceId);
  }
}
