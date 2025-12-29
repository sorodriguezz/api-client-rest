import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WorkspaceRoleAtLeast } from "../common/guards/workspace-role.guard";
import { ZodPipe } from "../common/zod.pipe";
import { CurrentUser } from "../common/decorators/user.decorator";
import { RealtimeService } from "../realtime/realtime.service";
import { NodesService } from "./nodes.service";
import {
  CloneRequestSchema,
  CloneTreeSchema,
  CreateNodeSchema,
  PatchNodeSchema,
  UpdateRequestSchema,
} from "./nodes.schemas";

@Controller()
@UseGuards(JwtAuthGuard)
export class NodesController {
  constructor(private nodes: NodesService, private rt: RealtimeService) {}

  @Get("workspaces/:workspaceId/tree")
  @UseGuards(WorkspaceRoleAtLeast("VIEWER"))
  tree(@Param("workspaceId") workspaceId: string) {
    return this.nodes.tree(workspaceId);
  }

  @Sse("workspaces/:workspaceId/events")
  @UseGuards(WorkspaceRoleAtLeast("VIEWER"))
  events(@Param("workspaceId") workspaceId: string): Observable<MessageEvent> {
    return this.rt.stream(workspaceId);
  }

  @Post("nodes")
  @UseGuards(WorkspaceRoleAtLeast("EDITOR"))
  create(
    @CurrentUser() user: any,
    @Body(new ZodPipe(CreateNodeSchema)) body: any
  ) {
    return this.nodes.create(user.userId, body);
  }

  @Patch("workspaces/:workspaceId/nodes/:nodeId")
  @UseGuards(WorkspaceRoleAtLeast("EDITOR"))
  patch(
    @CurrentUser() user: any,
    @Param("nodeId") nodeId: string,
    @Param("workspaceId") workspaceId: string,
    @Body(new ZodPipe(PatchNodeSchema)) body: any
  ) {
    return this.nodes.patch(user.userId, nodeId, body, workspaceId);
  }

  @Delete("workspaces/:workspaceId/nodes/:nodeId")
  @UseGuards(WorkspaceRoleAtLeast("EDITOR"))
  remove(
    @Param("nodeId") nodeId: string,
    @Param("workspaceId") workspaceId: string
  ) {
    return this.nodes.remove(nodeId, workspaceId);
  }

  @Get("workspaces/:workspaceId/requests/:nodeId")
  @UseGuards(WorkspaceRoleAtLeast("VIEWER"))
  getRequest(
    @Param("workspaceId") workspaceId: string,
    @Param("nodeId") nodeId: string
  ) {
    return this.nodes.getRequest(workspaceId, nodeId);
  }

  @Put("workspaces/:workspaceId/requests/:nodeId")
  @UseGuards(WorkspaceRoleAtLeast("EDITOR"))
  updateRequest(
    @CurrentUser() user: any,
    @Param("workspaceId") workspaceId: string,
    @Param("nodeId") nodeId: string,
    @Body(new ZodPipe(UpdateRequestSchema)) body: any
  ) {
    return this.nodes.updateRequest(user.userId, workspaceId, nodeId, body);
  }

  @Delete("workspaces/:workspaceId/requests/:nodeId")
  @UseGuards(WorkspaceRoleAtLeast("EDITOR"))
  removeRequest(
    @Param("workspaceId") workspaceId: string,
    @Param("nodeId") nodeId: string
  ) {
    return this.nodes.removeRequest(workspaceId, nodeId);
  }

  @Post("workspaces/:workspaceId/nodes/:nodeId/clone")
  @UseGuards(WorkspaceRoleAtLeast("EDITOR"))
  cloneRequest(
    @CurrentUser() user: any,
    @Param("workspaceId") workspaceId: string,
    @Param("nodeId") nodeId: string,
    @Body(new ZodPipe(CloneRequestSchema)) body: any
  ) {
    return this.nodes.cloneRequest(user.userId, workspaceId, nodeId, body);
  }

  @Post("workspaces/:workspaceId/nodes/:nodeId/clone-tree")
  @UseGuards(WorkspaceRoleAtLeast("EDITOR"))
  cloneTree(
    @CurrentUser() user: any,
    @Param("workspaceId") workspaceId: string,
    @Param("nodeId") nodeId: string,
    @Body(new ZodPipe(CloneTreeSchema)) body: any
  ) {
    return this.nodes.cloneTree(user.userId, workspaceId, nodeId, body);
  }
}
