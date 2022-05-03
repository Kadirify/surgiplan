import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@surgiplan/shared';
import { IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, RequirePermissions } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

class CreatePatientDto {
  @Matches(/^\d{5,20}$/, { message: 'Protokol numarası yalnızca rakamlardan oluşmalı.' }) mrn: string;
  @IsString() @MinLength(2) @MaxLength(60) firstName: string;
  @IsString() @MinLength(2) @MaxLength(60) lastName: string;
  @IsDateString() birthDate: string;
  @IsIn(['K', 'E']) gender: 'K' | 'E';
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(400) allergies?: string;
}

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permission.PatientsWrite)
  search(@Query('q') q = '') {
    const term = q.trim();
    if (term.length < 2) return [];
    const parts = term.split(/\s+/);
    return this.prisma.patient.findMany({
      where: /^\d+$/.test(term)
        ? { mrn: { startsWith: term } }
        : {
            AND: parts.map((p) => ({ OR: [{ firstName: { contains: p } }, { lastName: { contains: p } }] })),
          },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 20,
    });
  }

  @Get(':id')
  @RequirePermissions(Permission.PatientsWrite)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.patient.findUniqueOrThrow({ where: { id } });
  }

  @Post()
  @RequirePermissions(Permission.PatientsWrite)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePatientDto) {
    const patient = await this.prisma.patient.create({ data: { ...dto, birthDate: new Date(dto.birthDate) } });
    await this.audit.record({ actorId: user.id, action: 'patient.created', entity: 'patient', entityId: patient.id, changes: { mrn: dto.mrn } });
    return patient;
  }
}
