import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role, roleLabels } from '@surgiplan/shared';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../common/auth-user';
import { OutboxService } from '../notifications/outbox.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { InviteUserDto, ListUsersQuery, UpdateUserDto } from './users.dto';

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  title: true,
  phone: true,
  role: true,
  isActive: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  passwordHash: true,
  branch: { select: { id: true, name: true } },
  supervisor: { select: { id: true, fullName: true, title: true } },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function present(user: SelectedUser) {
  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    status: !user.isActive
      ? 'INACTIVE'
      : !passwordHash
      ? 'INVITED'
      : user.lockedUntil && user.lockedUntil > new Date()
      ? 'LOCKED'
      : 'ACTIVE',
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListUsersQuery) {
    const users = await this.prisma.user.findMany({
      where: {
        role: query.role,
        isActive: query.active,
        OR: query.q
          ? [{ fullName: { contains: query.q } }, { email: { contains: query.q } }]
          : undefined,
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      select: userSelect,
    });
    return users.map(present);
  }

  lookup(role?: Role) {
    return this.prisma.user.findMany({
      where: { role, isActive: true },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, title: true, role: true, branchId: true, supervisorId: true },
    });
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    return present(user);
  }

  async invite(actor: AuthUser, dto: InviteUserDto, ip?: string) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Bu e-posta adresiyle kayıtlı bir kullanıcı var.');
    }
    await this.assertSupervisor(dto.role, dto.supervisorId);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName: dto.fullName,
          role: dto.role,
          title: dto.title,
          phone: dto.phone,
          branchId: dto.branchId,
          supervisorId: dto.role === Role.Assistant ? dto.supervisorId : null,
        },
        select: userSelect,
      });
      await this.sendInvite(tx, actor, user.id, user.email, user.fullName, dto.role);
      await this.audit.record({ actorId: actor.id, action: 'user.invited', entity: 'user', entityId: user.id, changes: { email, role: dto.role }, ip }, tx);
      return present(user);
    });
  }

  async resendInvite(actor: AuthUser, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.passwordHash) throw new BadRequestException('Kullanıcı daveti zaten kabul etmiş.');

    await this.prisma.$transaction(async (tx) => {
      await this.sendInvite(tx, actor, user.id, user.email, user.fullName, user.role as Role);
      await this.audit.record({ actorId: actor.id, action: 'user.invite_resent', entity: 'user', entityId: id }, tx);
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto, ip?: string) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Kullanıcı bulunamadı.');

    if (actor.id === id && (dto.role && dto.role !== before.role || dto.isActive === false)) {
      throw new BadRequestException('Kendi rolünüzü değiştiremez ya da hesabınızı pasifleştiremezsiniz.');
    }

    const role = (dto.role ?? before.role) as Role;
    const supervisorId = role === Role.Assistant ? (dto.supervisorId !== undefined ? dto.supervisorId : before.supervisorId) : null;
    await this.assertSupervisor(role, supervisorId ?? undefined);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { ...dto, supervisorId },
        select: userSelect,
      });
      if (dto.isActive === false || (dto.role && dto.role !== before.role)) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await this.audit.record({ actorId: actor.id, action: 'user.updated', entity: 'user', entityId: id, changes: diff(before, dto), ip }, tx);
      return present(user);
    });
  }

  async unlock(actor: AuthUser, id: string) {
    await this.prisma.user.update({ where: { id }, data: { lockedUntil: null, failedLoginCount: 0 } });
    await this.audit.record({ actorId: actor.id, action: 'user.unlocked', entity: 'user', entityId: id });
  }

  async revokeSessions(actor: AuthUser, id: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ actorId: actor.id, action: 'user.sessions_revoked', entity: 'user', entityId: id });
  }

  private async sendInvite(tx: Tx, actor: AuthUser, userId: string, email: string, fullName: string, role: Role) {
    const inviter = await tx.user.findUnique({ where: { id: actor.id }, select: { fullName: true } });
    const token = await this.auth.createActionToken(tx, userId, 'INVITE');
    await this.outbox.enqueueEmail(tx, {
      to: email,
      subject: 'SurgiPlan hesabınız oluşturuldu',
      template: 'invite',
      data: {
        recipientName: fullName,
        invitedBy: inviter?.fullName ?? 'Sistem yöneticisi',
        roleLabel: roleLabels[role],
        link: `/set-password?token=${token}&invite=1`,
        expiresIn: '3 gün',
      },
    });
  }

  private async assertSupervisor(role: Role, supervisorId?: string | null) {
    if (role !== Role.Assistant || !supervisorId) return;
    const supervisor = await this.prisma.user.findUnique({ where: { id: supervisorId } });
    if (!supervisor || supervisor.role !== Role.Surgeon) {
      throw new BadRequestException('Asistanın sorumlu hekimi bir cerrah olmalıdır.');
    }
  }
}

function diff(before: Record<string, unknown>, patch: object) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && before[key] !== value) changes[key] = { from: before[key], to: value };
  }
  return changes;
}
