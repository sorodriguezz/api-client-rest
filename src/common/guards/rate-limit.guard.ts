import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private keyPrefix: string,
    private limit: number,
    private windowMs: number
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.userId ?? req.ip ?? "anon";
    const key = `${this.keyPrefix}:${userId}`;
    const now = Date.now();

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    existing.count += 1;
    if (existing.count > this.limit) {
      throw new HttpException(
        { error: "rate_limited" },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }
}

export function RateLimit(limit: number, windowMs: number, keyPrefix: string) {
  @Injectable()
  class Guard extends RateLimitGuard {
    constructor() {
      super(keyPrefix, limit, windowMs);
    }
  }

  return Guard;
}
