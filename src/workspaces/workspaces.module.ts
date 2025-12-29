import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WorkspaceSchema } from "./workspace.schema";
import { WorkspaceMemberSchema } from "../members/member.schema";
import { NodeSchema } from "../nodes/node.schema";
import { WorkspacesService } from "./workspaces.service";
import { WorkspacesController } from "./workspaces.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Workspace", schema: WorkspaceSchema },
      { name: "WorkspaceMember", schema: WorkspaceMemberSchema },
      { name: "Node", schema: NodeSchema },
    ]),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
})
export class WorkspacesModule {}
