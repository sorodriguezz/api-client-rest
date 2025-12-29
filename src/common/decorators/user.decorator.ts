import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type AuthUser = { userId: string; email: string };

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  }
);
