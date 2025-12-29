import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { UserDoc } from "../users/user.schema";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel("User") private userModel: Model<UserDoc>,
    private jwt: JwtService
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.userModel.findOne({ email }).lean();
    if (existing)
      throw new UnauthorizedException({ error: "email_already_exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userModel.create({
      email,
      name: name ?? null,
      passwordHash,
    });

    const token = await this.jwt.signAsync({
      sub: String(user._id),
      email: user.email,
    });
    return {
      user: { id: String(user._id), email: user.email, name: user.name },
      token,
    };
  }

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email });
    if (!user)
      throw new UnauthorizedException({ error: "invalid_credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException({ error: "invalid_credentials" });

    const token = await this.jwt.signAsync({
      sub: String(user._id),
      email: user.email,
    });
    return {
      user: { id: String(user._id), email: user.email, name: user.name },
      token,
    };
  }
}
