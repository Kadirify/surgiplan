import { Injectable } from '@nestjs/common';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { MailTemplate, OutboxService } from './outbox.service';

export interface NotifyInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
  email?: {
    subject: string;
    template: MailTemplate;
    data: Record<string, unknown>;
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: OutboxService) {}

  async notify(tx: Tx, userIds: Iterable<string>, input: NotifyInput, exceptUserId?: string) {
    const ids = [...new Set(userIds)].filter((id) => id && id !== exceptUserId);
    if (!ids.length) return;

    const users = await tx.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, email: true, fullName: true, emailNotifications: true },
    });

    for (const user of users) {
      await tx.notification.create({
        data: { userId: user.id, type: input.type, title: input.title, body: input.body, link: input.link },
      });
      if (input.email && user.emailNotifications) {
        await this.outbox.enqueueEmail(tx, {
          to: user.email,
          subject: input.email.subject,
          template: input.email.template,
          data: { ...input.email.data, recipientName: user.fullName, link: input.link },
        });
      }
    }
  }

  list(userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, readAt: unreadOnly ? null : undefined },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
