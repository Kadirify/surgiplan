import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { addMinutes } from 'date-fns';
import { Env, ENV } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';
import { EmailPayload } from './outbox.service';

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 6;
const LEASE_MINUTES = 2;

@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Interval(10_000)
  async tick() {
    if (!this.env.MAIL_WORKER_ENABLED || this.running) return;
    this.running = true;
    try {
      await this.drain();
    } finally {
      this.running = false;
    }
  }

  private async drain() {
    const now = new Date();
    const candidates = await this.prisma.outboxMessage.findMany({
      where: {
        status: 'PENDING',
        nextAttemptAt: { lte: now },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const message of candidates) {
      // Lease the row so a second API instance cannot pick the same message.
      const claimed = await this.prisma.outboxMessage.updateMany({
        where: {
          id: message.id,
          status: 'PENDING',
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
        },
        data: { lockedUntil: addMinutes(now, LEASE_MINUTES) },
      });
      if (claimed.count === 0) continue;

      try {
        await this.process(message.kind, message.payload);
        await this.prisma.outboxMessage.update({
          where: { id: message.id },
          data: { status: 'SENT', processedAt: new Date(), lockedUntil: null },
        });
      } catch (err) {
        const attempts = message.attempts + 1;
        const failed = attempts >= MAX_ATTEMPTS;
        this.logger.warn(`Outbox ${message.id} failed (attempt ${attempts}): ${(err as Error).message}`);
        await this.prisma.outboxMessage.update({
          where: { id: message.id },
          data: {
            attempts,
            status: failed ? 'FAILED' : 'PENDING',
            nextAttemptAt: addMinutes(new Date(), 2 ** attempts),
            lastError: (err as Error).message.slice(0, 1000),
            lockedUntil: null,
          },
        });
      }
    }
  }

  private async process(kind: string, raw: string) {
    switch (kind) {
      case 'email':
        return this.mailer.send(JSON.parse(raw) as EmailPayload);
      default:
        throw new Error(`Unknown outbox kind: ${kind}`);
    }
  }
}
