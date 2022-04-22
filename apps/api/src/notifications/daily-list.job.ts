import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HOSPITAL_TIME_ZONE, SurgeryStatus } from '@surgiplan/shared';
import { addDays } from 'date-fns';
import { formatHospital, hospitalDate, hospitalDayRange } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from './outbox.service';

@Injectable()
export class DailyListJob {
  private readonly logger = new Logger(DailyListJob.name);

  constructor(private readonly prisma: PrismaService, private readonly outbox: OutboxService) {}

  @Cron('0 17 * * *', { timeZone: HOSPITAL_TIME_ZONE })
  async sendTomorrowsList() {
    const day = hospitalDate(addDays(new Date(), 1));
    const sent = await this.sendFor(day);
    this.logger.log(`Daily list for ${day} queued for ${sent} recipients`);
  }

  async sendFor(day: string): Promise<number> {
    const { from, to } = hospitalDayRange(day);
    const surgeries = await this.prisma.surgery.findMany({
      where: {
        status: { in: [SurgeryStatus.Scheduled, SurgeryStatus.Preparing] },
        plannedStart: { gte: from, lt: to },
      },
      orderBy: { plannedStart: 'asc' },
      include: {
        room: true,
        procedure: true,
        patient: true,
        surgeon: true,
        anesthetist: true,
        team: { include: { user: true } },
      },
    });

    const byUser = new Map<string, { email: string; name: string; wants: boolean; rows: unknown[] }>();
    for (const s of surgeries) {
      const row = {
        time: formatHospital(s.plannedStart!, 'HH:mm'),
        room: s.room?.code,
        procedure: s.procedure.name,
        patient: `${s.patient.firstName} ${s.patient.lastName.charAt(0)}.`,
        surgeon: s.surgeon.fullName,
      };
      const people = [s.surgeon, s.anesthetist, ...s.team.map((t) => t.user)].filter(Boolean);
      for (const p of people) {
        if (!p) continue;
        const entry = byUser.get(p.id) ?? { email: p.email, name: p.fullName, wants: p.emailNotifications, rows: [] };
        entry.rows.push(row);
        byUser.set(p.id, entry);
      }
    }

    const dayLabel = formatHospital(from, 'd MMMM yyyy, EEEE');
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const entry of byUser.values()) {
        if (!entry.wants) continue;
        await this.outbox.enqueueEmail(tx, {
          to: entry.email,
          subject: `Yarınki ameliyat listeniz (${entry.rows.length} vaka)`,
          template: 'daily-list',
          data: { recipientName: entry.name, dayLabel, rows: entry.rows, link: `/schedule?date=${day}` },
        });
        count++;
      }
    });
    return count;
  }
}
