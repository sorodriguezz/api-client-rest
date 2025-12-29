import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NodeSchema } from "./node.schema";
import { WorkspaceMemberSchema } from "../members/member.schema";
import { NodesController } from "./nodes.controller";
import { NodesService } from "./nodes.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Node", schema: NodeSchema },
      { name: "WorkspaceMember", schema: WorkspaceMemberSchema },
    ]),
  ],
  controllers: [NodesController],
  providers: [NodesService],
})
export class NodesModule {}
