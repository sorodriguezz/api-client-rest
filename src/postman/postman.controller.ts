import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { PostmanService } from "./postman.service";

import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WorkspaceRoleAtLeast } from "../common/guards/workspace-role.guard";
import { RateLimit } from "../common/guards/rate-limit.guard";
import { CurrentUser } from "../common/decorators/user.decorator";

const POSTMAN_IMPORT_RATE_LIMIT = Math.max(
  1,
  Number(process.env.POSTMAN_IMPORT_RATE_LIMIT || 5)
);
const POSTMAN_IMPORT_WINDOW_MS = Math.max(
  1_000,
  Number(process.env.POSTMAN_IMPORT_WINDOW_MS || 60_000)
);

@Controller("workspaces/:workspaceId/postman")
@UseGuards(JwtAuthGuard)
export class PostmanController {
  constructor(private postman: PostmanService) {}

  @Post("import")
  @UseGuards(WorkspaceRoleAtLeast("EDITOR"))
  @UseGuards(
    RateLimit(
      POSTMAN_IMPORT_RATE_LIMIT,
      POSTMAN_IMPORT_WINDOW_MS,
      "postman.import"
    )
  )
  importCollection(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: any,
    @Body() body: any
  ) {
    return this.postman.importCollection(workspaceId, user.userId, body);
  }

  @Get("export")
  @UseGuards(WorkspaceRoleAtLeast("VIEWER"))
  exportCollection(@Param("workspaceId") workspaceId: string) {
    return this.postman.exportCollection(workspaceId);
  }
}
