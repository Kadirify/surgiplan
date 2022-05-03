import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { hasPermission, Permission } from '@surgiplan/shared';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

class CreateUnavailabilityDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @IsIn(['LEAVE', 'DUTY', 'CONGRESS', 'OTHER']) kind: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

@ApiTags('unavailability')
@ApiBearerAuth()
@Controller('unavailability')
export class UnavailabilityController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string, @Query('userId') userId?: string) {
    const canSeeAll = hasPermission(user.role, Permission.UnavailabilityManageAll) || hasPermission(user.role, Permission.SurgeriesReadAll);
    return this.prisma.unavailability.findMany({
      where: {
        userId: canSeeAll ? userId || undefined : user.id,
        endsAt: from ? { gt: new Date(from) } : undefined,
        startsAt: to ? { lt: new Date(to) } : undefined,
      },
      include: { user: { select: { id: true, fullName: true, title: true, role: true } } },
      orderBy: { startsAt: 'asc' },
    });
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateUnavailabilityDto) {
    const userId = dto.userId ?? user.id;
    if (userId !== user.id && !hasPermission(user.role, Permission.UnavailabilityManageAll)) {
      throw new ForbiddenException('Yalnızca kendi izinlerinizi girebilirsiniz.');
    }
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('Bitiş tarihi başlangıçtan sonra olmalıdır.');

    const record = await this.prisma.unavailability.create({ data: { userId, startsAt, endsAt, kind: dto.kind, note: dto.note } });
    await this.audit.record({ actorId: user.id, action: 'unavailability.created', entity: 'user', entityId: userId, changes: dto });
    return record;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const record = await this.prisma.unavailability.findUniqueOrThrow({ where: { id } });
    if (record.userId !== user.id && !hasPermission(user.role, Permission.UnavailabilityManageAll)) {
      throw new ForbiddenException();
    }
    await this.prisma.unavailability.delete({ where: { id } });
    await this.audit.record({ actorId: user.id, action: 'unavailability.deleted', entity: 'user', entityId: record.userId });
  }
}
