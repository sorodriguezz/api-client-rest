import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NodeSchema } from "../nodes/node.schema";
import { WorkspaceMemberSchema } from "../members/member.schema";
import { RunnerService } from "./runner.service";
import { RunnerController } from "./runner.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Node", schema: NodeSchema },
      { name: "WorkspaceMember", schema: WorkspaceMemberSchema },
    ]),
  ],
  controllers: [RunnerController],
  providers: [RunnerService],
})
export class RunnerModule {}
