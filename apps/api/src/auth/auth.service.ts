import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { Role, rolePermissions } from '@surgiplan/shared';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { addDays, addHours, addMinutes } from 'date-fns';
import { AuditService } from '../audit/audit.service';
import { Env, ENV } from '../config/env';
import { OutboxService } from '../notifications/outbox.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { generateOpaqueToken, hashToken } from './tokens';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const BCRYPT_ROUNDS = 11;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export type ActionPurpose = 'INVITE' | 'RESET';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async login(email: string, password: string, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const invalid = new UnauthorizedException('E-posta veya şifre hatalı.');

    if (!user || !user.passwordHash || !user.isActive) {
      // Keep timing similar for unknown accounts.
      await compare(password, '$2a$11$C6UzMDM.H6dfI/f/IKcEeO5nBEoKXUD1C8xP5WvYvSH0yH5X3pW9u');
      throw invalid;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Çok sayıda hatalı deneme nedeniyle hesabınız geçici olarak kilitlendi. Lütfen daha sonra tekrar deneyin.');
    }

    if (!(await compare(password, user.passwordHash))) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? addMinutes(new Date(), LOCK_MINUTES) : null,
        },
      });
      await this.audit.record({ actorId: user.id, action: 'auth.login_failed', entity: 'user', entityId: user.id, ip: meta.ip });
      throw invalid;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.record({ actorId: user.id, action: 'auth.login', entity: 'user', entityId: user.id, ip: meta.ip });

    return this.issueTokens(user, randomUUID(), meta.userAgent);
  }

  async refresh(rawToken: string | undefined, userAgent?: string): Promise<SessionTokens> {
    if (!rawToken) throw new UnauthorizedException();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException();

    if (stored.revokedAt) {
      // A rotated token came back: assume it leaked and kill the whole family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({ actorId: stored.userId, action: 'auth.refresh_reuse', entity: 'user', entityId: stored.userId });
      throw new UnauthorizedException();
    }

    if (stored.expiresAt < new Date() || !stored.user.isActive) throw new UnauthorizedException();

    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw new UnauthorizedException();

    return this.issueTokens(stored.user, stored.familyId, userAgent);
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!stored) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { branch: true, supervisor: { select: { id: true, fullName: true, title: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      title: user.title,
      phone: user.phone,
      role: user.role as Role,
      branch: user.branch,
      supervisor: user.supervisor,
      theme: user.theme,
      emailNotifications: user.emailNotifications,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      permissions: rolePermissions[user.role as Role],
    };
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await compare(current, user.passwordHash))) {
      throw new BadRequestException('Mevcut şifre hatalı.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: await hash(next, BCRYPT_ROUNDS), mustChangePassword: false },
      });
      await this.audit.record({ actorId: userId, action: 'auth.password_changed', entity: 'user', entityId: userId }, tx);
    });
  }

  async createActionToken(tx: Tx, userId: string, purpose: ActionPurpose): Promise<string> {
    const raw = generateOpaqueToken();
    await tx.actionToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.actionToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(raw),
        expiresAt: purpose === 'INVITE' ? addDays(new Date(), 3) : addHours(new Date(), 1),
      },
    });
    return raw;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) return;

    await this.prisma.$transaction(async (tx) => {
      const token = await this.createActionToken(tx, user.id, 'RESET');
      await this.outbox.enqueueEmail(tx, {
        to: user.email,
        subject: 'SurgiPlan şifre sıfırlama',
        template: 'reset-password',
        data: { recipientName: user.fullName, link: `/set-password?token=${token}`, expiresIn: '1 saat' },
      });
      await this.audit.record({ actorId: user.id, action: 'auth.reset_requested', entity: 'user', entityId: user.id }, tx);
    });
  }

  async setPassword(rawToken: string, password: string) {
    const token = await this.prisma.actionToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw new BadRequestException('Bağlantı geçersiz ya da süresi dolmuş.');
    }

    await this.prisma.$transaction(async (tx) => {
      const used = await tx.actionToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (used.count === 0) throw new BadRequestException('Bağlantı daha önce kullanılmış.');

      await tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: await hash(password, BCRYPT_ROUNDS),
          mustChangePassword: false,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.refreshToken.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record(
        { actorId: token.userId, action: token.purpose === 'INVITE' ? 'auth.invite_accepted' : 'auth.password_reset', entity: 'user', entityId: token.userId },
        tx,
      );
    });
  }

  private async issueTokens(user: User, familyId: string, userAgent?: string): Promise<SessionTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, email: user.email },
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.ACCESS_TOKEN_TTL },
    );
    const refreshToken = generateOpaqueToken();
    const refreshExpiresAt = addDays(new Date(), this.env.REFRESH_TOKEN_TTL_DAYS);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: userAgent?.slice(0, 200),
      },
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }
}
