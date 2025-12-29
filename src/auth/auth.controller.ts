import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { ZodPipe } from "../common/zod.pipe";
import { AuthService } from "./auth.service";
import { type LoginDto, LoginSchema, type RegisterDto, RegisterSchema } from "./auth.schemas";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("register")
  @UsePipes(new ZodPipe(RegisterSchema))
  register(@Body() body: RegisterDto) {
    return this.auth.register(body.email, body.password, body.name);
  }

  @Post("login")
  @UsePipes(new ZodPipe(LoginSchema))
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }
}
