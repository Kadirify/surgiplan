import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@surgiplan/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, RequirePermissions } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentDto, ProcedureDto, RoomDto, UpdateEquipmentDto, UpdateProcedureDto, UpdateRoomDto } from './catalog.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller()
export class CatalogController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get('branches')
  branches() {
    return this.prisma.branch.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('rooms')
  rooms(@Query('all') all?: string) {
    return this.prisma.room.findMany({
      where: all === 'true' ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  @Post('rooms')
  @RequirePermissions(Permission.CatalogManage)
  async createRoom(@CurrentUser() user: AuthUser, @Body() dto: RoomDto) {
    const room = await this.prisma.room.create({ data: dto });
    await this.audit.record({ actorId: user.id, action: 'room.created', entity: 'room', entityId: room.id, changes: dto });
    return room;
  }

  @Patch('rooms/:id')
  @RequirePermissions(Permission.CatalogManage)
  async updateRoom(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto) {
    const room = await this.prisma.room.update({ where: { id }, data: dto });
    await this.audit.record({ actorId: user.id, action: 'room.updated', entity: 'room', entityId: id, changes: dto });
    return room;
  }

  @Get('equipment')
  equipment() {
    return this.prisma.equipment.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('equipment')
  @RequirePermissions(Permission.CatalogManage)
  async createEquipment(@CurrentUser() user: AuthUser, @Body() dto: EquipmentDto) {
    const item = await this.prisma.equipment.create({ data: dto });
    await this.audit.record({ actorId: user.id, action: 'equipment.created', entity: 'equipment', entityId: item.id, changes: dto });
    return item;
  }

  @Patch('equipment/:id')
  @RequirePermissions(Permission.CatalogManage)
  async updateEquipment(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEquipmentDto) {
    const item = await this.prisma.equipment.update({ where: { id }, data: dto });
    await this.audit.record({ actorId: user.id, action: 'equipment.updated', entity: 'equipment', entityId: id, changes: dto });
    return item;
  }

  @Get('procedures')
  procedures(@Query('branchId') branchId?: string, @Query('q') q?: string) {
    return this.prisma.procedure.findMany({
      where: {
        isActive: true,
        branchId: branchId || undefined,
        OR: q ? [{ name: { contains: q } }, { code: { contains: q } }] : undefined,
      },
      include: { branch: true },
      orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  @Post('procedures')
  @RequirePermissions(Permission.CatalogManage)
  async createProcedure(@CurrentUser() user: AuthUser, @Body() dto: ProcedureDto) {
    const item = await this.prisma.procedure.create({ data: dto });
    await this.audit.record({ actorId: user.id, action: 'procedure.created', entity: 'procedure', entityId: item.id, changes: dto });
    return item;
  }

  @Patch('procedures/:id')
  @RequirePermissions(Permission.CatalogManage)
  async updateProcedure(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProcedureDto) {
    const item = await this.prisma.procedure.update({ where: { id }, data: dto });
    await this.audit.record({ actorId: user.id, action: 'procedure.updated', entity: 'procedure', entityId: id, changes: dto });
    return item;
  }
}
