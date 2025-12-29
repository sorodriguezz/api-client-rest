import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserSchema } from "./user.schema";
import { WorkspaceSchema } from "../workspaces/workspace.schema";
import { WorkspaceMemberSchema } from "../members/member.schema";
import { NodeSchema } from "../nodes/node.schema";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "User", schema: UserSchema },
      { name: "Workspace", schema: WorkspaceSchema },
      { name: "WorkspaceMember", schema: WorkspaceMemberSchema },
      { name: "Node", schema: NodeSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
