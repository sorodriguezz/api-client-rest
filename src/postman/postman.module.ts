import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PostmanController } from "./postman.controller";
import { PostmanService } from "./postman.service";

import { NodeSchema } from "../nodes/node.schema";
import { WorkspaceSchema } from "../workspaces/workspace.schema";

import { WorkspaceMemberSchema } from "../members/member.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Node", schema: NodeSchema },
      { name: "Workspace", schema: WorkspaceSchema },
      { name: "WorkspaceMember", schema: WorkspaceMemberSchema },
    ]),
  ],
  controllers: [PostmanController],
  providers: [PostmanService],
})
export class PostmanModule {}
