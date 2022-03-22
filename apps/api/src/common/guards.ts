import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { hasPermission, Permission, Role } from '@surgiplan/shared';
import { Request } from 'express';
import { Env, ENV } from '../config/env';
import { AuthUser, IS_PUBLIC, PERMISSIONS } from './auth-user';

interface AccessPayload {
  sub: string;
  role: Role;
  email: string;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();

    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(header.slice(7), {
        secret: this.env.JWT_ACCESS_SECRET,
      });
      req.user = { id: payload.sub, role: payload.role, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) return false;
    if (!required.every((p) => hasPermission(user.role, p))) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    }
    return true;
  }
}
