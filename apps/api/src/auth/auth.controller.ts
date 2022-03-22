import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import { AuthUser, CurrentUser, Public } from '../common/auth-user';
import { Env, ENV } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, SetPasswordDto, UpdateProfileDto } from './auth.dto';
import { AuthService, SessionTokens } from './auth.service';

const REFRESH_COOKIE = 'sp_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Throttle(10, 60)
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.login(dto.email, dto.password, { ip: req.ip, userAgent: req.headers['user-agent'] });
    return this.respondWithTokens(res, tokens);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const tokens = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], req.headers['user-agent']);
      return this.respondWithTokens(res, tokens);
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Public()
  @Throttle(5, 300)
  @Post('forgot-password')
  @HttpCode(204)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle(10, 300)
  @Post('set-password')
  @HttpCode(204)
  async setPassword(@Body() dto: SetPasswordDto) {
    await this.auth.setPassword(dto.token, dto.password);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @Patch('me')
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    await this.prisma.user.update({ where: { id: user.id }, data: dto });
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  private respondWithTokens(res: Response, tokens: SessionTokens) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...this.cookieOptions(), expires: tokens.refreshExpiresAt });
    return { accessToken: tokens.accessToken };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.env.NODE_ENV === 'production' && this.env.WEB_ORIGIN.startsWith('https'),
      path: '/api/auth',
    };
  }
}
