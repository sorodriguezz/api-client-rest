import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RateLimit } from "../common/guards/rate-limit.guard";
import { WorkspaceRoleAtLeast } from "../common/guards/workspace-role.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ExecuteSchema } from "./runner.schemas";
import { RunnerService } from "./runner.service";

const RUNNER_RATE_LIMIT = Math.max(
  1,
  Number(process.env.RUNNER_RATE_LIMIT || 30)
);
const RUNNER_RATE_WINDOW_MS = Math.max(
  1_000,
  Number(process.env.RUNNER_RATE_WINDOW_MS || 60_000)
);

@Controller("runner")
@UseGuards(JwtAuthGuard)
export class RunnerController {
  constructor(private runner: RunnerService) {}

  @Post("execute")
  @UseGuards(WorkspaceRoleAtLeast("VIEWER"))
  @UseGuards(
    RateLimit(RUNNER_RATE_LIMIT, RUNNER_RATE_WINDOW_MS, "runner.execute")
  )
  execute(@Body(new ZodPipe(ExecuteSchema)) body: any) {
    return this.runner.execute(body.workspaceId, body.nodeId, body.timeoutMs);
  }
}
