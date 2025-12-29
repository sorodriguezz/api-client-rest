import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI || "mongodb://localhost:27017/postmanish",
      {
        autoIndex: true,
      }
    ),
  ],
  exports: [MongooseModule],
})
export class DataBaseModule {}
