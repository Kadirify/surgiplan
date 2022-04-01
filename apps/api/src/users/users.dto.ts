import { ROLES, Role } from '@surgiplan/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ListUsersQuery {
  @IsOptional() @IsIn(ROLES) role?: Role;
  @IsOptional() @IsString() q?: string;
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true'))
  @IsBoolean()
  active?: boolean;
}

export class InviteUserDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin.' })
  email: string;

  @IsString() @MinLength(3) @MaxLength(120)
  fullName: string;

  @IsIn(ROLES)
  role: Role;

  @IsOptional() @IsString() @MaxLength(40)
  title?: string;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @IsOptional() @IsUUID()
  branchId?: string;

  @IsOptional() @IsUUID()
  supervisorId?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120)
  fullName?: string;

  @IsOptional() @IsIn(ROLES)
  role?: Role;

  @IsOptional() @IsString() @MaxLength(40)
  title?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string | null;

  @IsOptional() @IsUUID()
  branchId?: string | null;

  @IsOptional() @IsUUID()
  supervisorId?: string | null;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
