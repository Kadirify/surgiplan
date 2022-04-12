import { AnesthesiaType, Laterality, Priority, SurgeryStatus, TeamRole } from '@surgiplan/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const statuses = Object.values(SurgeryStatus);

export class TeamMemberDto {
  @IsUUID() userId: string;
  @IsIn(Object.values(TeamRole)) role: TeamRole;
}

class SurgeryDetailsDto {
  @IsOptional() @IsIn(Object.values(AnesthesiaType)) anesthesiaType?: AnesthesiaType;
  @IsOptional() @IsIn(Object.values(Laterality)) laterality?: Laterality;
  @IsOptional() @IsIn(Object.values(Priority)) priority?: Priority;
  @IsOptional() @IsInt() @Min(10) @Max(960) estimatedMinutes?: number;
  @IsOptional() @IsDateString() requestedDate?: string;
  @IsOptional() @IsString() @MaxLength(300) diagnosis?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsUUID() anesthetistId?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => TeamMemberDto)
  team?: TeamMemberDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUUID('all', { each: true })
  equipmentIds?: string[];
}

export class CreateSurgeryDto extends SurgeryDetailsDto {
  @IsUUID() patientId: string;
  @IsUUID() procedureId: string;
  @IsOptional() @IsUUID() surgeonId?: string;
  @IsOptional() @IsBoolean() submit?: boolean;
}

export class UpdateSurgeryDto extends SurgeryDetailsDto {
  @IsInt() version: number;
}

export class ScheduleDto {
  @IsUUID() roomId: string;
  @IsDateString() plannedStart: string;
  @IsOptional() @IsInt() @Min(10) @Max(960) durationMinutes?: number;
  @IsOptional() @IsUUID() anesthetistId?: string;
  @IsInt() version: number;
  @IsOptional() @IsBoolean() acknowledgeWarnings?: boolean;
}

export class ConflictPreviewDto {
  @IsOptional() @IsUUID() surgeryId?: string;
  @IsUUID() roomId: string;
  @IsDateString() plannedStart: string;
  @IsInt() @Min(10) @Max(960) durationMinutes: number;
  @IsUUID() surgeonId: string;
  @IsOptional() @IsUUID() anesthetistId?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) teamIds?: string[];
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) equipmentIds?: string[];
}

export class TransitionDto {
  @IsIn(statuses) to: SurgeryStatus;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsInt() version: number;
}

export class ChecklistUpdateDto {
  @IsBoolean() checked: boolean;
}

export class ListSurgeriesQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsUUID() roomId?: string;
  @IsOptional() @IsUUID() surgeonId?: string;
  @IsOptional() @IsString() q?: string;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : String(value).split(',')))
  @IsIn(statuses, { each: true })
  status?: SurgeryStatus[];

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  mine?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) take?: number;
}
