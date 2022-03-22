import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_RULE = /^(?=.*[a-zçğıöşü])(?=.*[A-ZÇĞİÖŞÜ])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE = 'Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.';

export class LoginDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin.' })
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class SetPasswordDto {
  @IsString()
  token: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark';

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;
}
