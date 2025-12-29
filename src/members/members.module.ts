import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WorkspaceMemberSchema } from "./member.schema";
import { UserSchema } from "../users/user.schema";
import { MembersController } from "./members.controller";
import { WorkspaceMembersController } from "./workspace-members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "WorkspaceMember", schema: WorkspaceMemberSchema },
      { name: "User", schema: UserSchema },
    ]),
  ],
  controllers: [MembersController, WorkspaceMembersController],
  providers: [MembersService],
})
export class MembersModule {}
