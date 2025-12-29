import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { DataBaseModule } from "./database/database.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { MembersModule } from "./members/members.module";
import { NodesModule } from "./nodes/nodes.module";
import { RunnerModule } from "./runner/runner.module";
import { PostmanModule } from "./postman/postman.module";

@Module({
  imports: [
    DataBaseModule,
    HealthModule,
    RealtimeModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    MembersModule,
    NodesModule,
    RunnerModule,
    PostmanModule,
  ],
})
export class AppModule {}
