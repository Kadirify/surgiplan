import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Permission, Role } from '@surgiplan/shared';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const PERMISSIONS = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS, permissions);
