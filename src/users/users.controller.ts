import { Controller, Delete, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/user.decorator";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Delete(":userId")
  remove(
    @CurrentUser() user: any,
    @Param("userId") userId: string,
    @Query("force") force?: string
  ) {
    const forceDelete = force === "true" || force === "1";
    return this.users.deleteUser(user, userId, forceDelete);
  }
}
