import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, ROLES, Role } from '@surgiplan/shared';
import { Request } from 'express';
import { AuthUser, CurrentUser, RequirePermissions } from '../common/auth-user';
import { InviteUserDto, ListUsersQuery, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(Permission.UsersManage)
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Get('lookup')
  @RequirePermissions(Permission.UsersRead)
  lookup(@Query('role') role?: string) {
    return this.users.lookup(ROLES.includes(role as Role) ? (role as Role) : undefined);
  }

  @Get(':id')
  @RequirePermissions(Permission.UsersManage)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Post()
  @RequirePermissions(Permission.UsersManage)
  invite(@CurrentUser() actor: AuthUser, @Body() dto: InviteUserDto, @Req() req: Request) {
    return this.users.invite(actor, dto, req.ip);
  }

  @Patch(':id')
  @RequirePermissions(Permission.UsersManage)
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @Req() req: Request) {
    return this.users.update(actor, id, dto, req.ip);
  }

  @Post(':id/resend-invite')
  @HttpCode(204)
  @RequirePermissions(Permission.UsersManage)
  resendInvite(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.resendInvite(actor, id);
  }

  @Post(':id/unlock')
  @HttpCode(204)
  @RequirePermissions(Permission.UsersManage)
  unlock(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.unlock(actor, id);
  }

  @Post(':id/revoke-sessions')
  @HttpCode(204)
  @RequirePermissions(Permission.UsersManage)
  revokeSessions(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.revokeSessions(actor, id);
  }
}
