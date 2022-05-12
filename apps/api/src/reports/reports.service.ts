import { Injectable } from '@nestjs/common';
import { HOSPITAL_TIME_ZONE, SurgeryStatus, WORKING_HOURS } from '@surgiplan/shared';
import { addDays, differenceInMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { hospitalDate, startOfHospitalDay } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';

const ON_TIME_TOLERANCE_MINUTES = 10;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(fromDate: string, toDate: string) {
    const from = startOfHospitalDay(fromDate);
    const to = startOfHospitalDay(hospitalDate(addDays(startOfHospitalDay(toDate), 1)));

    const [rooms, surgeries] = await Promise.all([
      this.prisma.room.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      this.prisma.surgery.findMany({
        where: { plannedStart: { gte: from, lt: to } },
        include: { procedure: { select: { id: true, name: true } }, surgeon: { select: { id: true, fullName: true, title: true } } },
      }),
    ]);

    const completed = surgeries.filter((s) => s.status === SurgeryStatus.Completed && s.actualStart && s.actualEnd);
    const minutes = (s: typeof completed[number]) => differenceInMinutes(s.actualEnd!, s.actualStart!);

    const workingDays = this.countWorkingDays(from, to);
    const availablePerRoom = workingDays * (WORKING_HOURS.end - WORKING_HOURS.start) * 60;

    const utilization = rooms.map((room) => {
      const used = completed.filter((s) => s.roomId === room.id).reduce((sum, s) => sum + minutes(s), 0);
      return {
        roomId: room.id,
        code: room.code,
        name: room.name,
        usedMinutes: used,
        availableMinutes: availablePerRoom,
        rate: availablePerRoom ? used / availablePerRoom : 0,
      };
    });

    const lost = surgeries.filter((s) => s.status === SurgeryStatus.Cancelled || s.status === SurgeryStatus.Postponed);
    const reasonCounts = new Map<string, { reason: string; cancelled: number; postponed: number }>();
    for (const s of lost) {
      const reason = s.statusReason?.trim() || 'Belirtilmemiş';
      const entry = reasonCounts.get(reason) ?? { reason, cancelled: 0, postponed: 0 };
      if (s.status === SurgeryStatus.Cancelled) entry.cancelled++;
      else entry.postponed++;
      reasonCounts.set(reason, entry);
    }

    const byProcedure = new Map<string, { procedure: string; count: number; estimated: number; actual: number }>();
    for (const s of completed) {
      const entry = byProcedure.get(s.procedureId) ?? { procedure: s.procedure.name, count: 0, estimated: 0, actual: 0 };
      entry.count++;
      entry.estimated += s.estimatedMinutes;
      entry.actual += minutes(s);
      byProcedure.set(s.procedureId, entry);
    }

    const firstCases = new Map<string, typeof completed[number]>();
    for (const s of completed) {
      const key = `${s.roomId}:${hospitalDate(s.plannedStart!)}`;
      const current = firstCases.get(key);
      if (!current || s.plannedStart! < current.plannedStart!) firstCases.set(key, s);
    }
    const firstCaseList = [...firstCases.values()];
    const onTime = firstCaseList.filter((s) => differenceInMinutes(s.actualStart!, s.plannedStart!) <= ON_TIME_TOLERANCE_MINUTES).length;

    const daily = new Map<string, { date: string; completed: number; cancelled: number; postponed: number }>();
    for (const s of surgeries) {
      const date = hospitalDate(s.plannedStart!);
      const entry = daily.get(date) ?? { date, completed: 0, cancelled: 0, postponed: 0 };
      if (s.status === SurgeryStatus.Completed) entry.completed++;
      if (s.status === SurgeryStatus.Cancelled) entry.cancelled++;
      if (s.status === SurgeryStatus.Postponed) entry.postponed++;
      daily.set(date, entry);
    }

    const totalUsed = utilization.reduce((sum, u) => sum + u.usedMinutes, 0);
    const totalAvailable = utilization.reduce((sum, u) => sum + u.availableMinutes, 0);

    return {
      range: { from: fromDate, to: toDate, workingDays },
      summary: {
        total: surgeries.length,
        completed: completed.length,
        cancelled: lost.filter((s) => s.status === SurgeryStatus.Cancelled).length,
        postponed: lost.filter((s) => s.status === SurgeryStatus.Postponed).length,
        utilizationRate: totalAvailable ? totalUsed / totalAvailable : 0,
        firstCaseOnTimeRate: firstCaseList.length ? onTime / firstCaseList.length : null,
      },
      utilization,
      lostCases: [...reasonCounts.values()].sort((a, b) => b.cancelled + b.postponed - (a.cancelled + a.postponed)),
      durationAccuracy: [...byProcedure.values()]
        .map((p) => ({
          procedure: p.procedure,
          count: p.count,
          avgEstimated: Math.round(p.estimated / p.count),
          avgActual: Math.round(p.actual / p.count),
          avgDelta: Math.round((p.actual - p.estimated) / p.count),
        }))
        .sort((a, b) => Math.abs(b.avgDelta) - Math.abs(a.avgDelta)),
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  private countWorkingDays(from: Date, to: Date) {
    let count = 0;
    for (let d = from; d < to; d = addDays(d, 1)) {
      const weekday = Number(formatInTimeZone(d, HOSPITAL_TIME_ZONE, 'i'));
      if (weekday <= 5) count++;
    }
    return count;
  }
}
