import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class RoomDto {
  @IsString() @Matches(/^[A-Z0-9-]{2,10}$/, { message: 'Kod 2-10 karakter, büyük harf/rakam/tire olmalı.' })
  code: string;
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(20) floor?: string;
  @IsInt() @Min(0) @Max(240) turnoverMinutes: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() @MaxLength(400) notes?: string;
}
export class UpdateRoomDto extends PartialType(RoomDto) {}

export class EquipmentDto {
  @IsString() @Matches(/^[A-Z0-9-]{2,20}$/) code: string;
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsInt() @Min(1) @Max(50) quantity: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateEquipmentDto extends PartialType(EquipmentDto) {}

export class ProcedureDto {
  @IsString() @Matches(/^[A-Z0-9-]{2,20}$/) code: string;
  @IsString() @MinLength(3) @MaxLength(160) name: string;
  @IsUUID() branchId: string;
  @IsInt() @Min(10) @Max(960) defaultDurationMinutes: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateProcedureDto extends PartialType(ProcedureDto) {}
