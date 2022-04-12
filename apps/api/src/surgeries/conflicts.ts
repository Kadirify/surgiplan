import { Conflict } from '@surgiplan/shared';
import { formatHospital } from '../common/time';

export interface Booking {
  id: string;
  label: string;
  roomId: string | null;
  start: Date;
  end: Date;
  surgeonId: string;
  anesthetistId: string | null;
  teamIds: readonly string[];
  equipmentIds: readonly string[];
}

export interface Candidate extends Omit<Booking, 'id' | 'label' | 'roomId'> {
  id?: string;
  roomId: string;
}

export interface Absence {
  userId: string;
  start: Date;
  end: Date;
  reason: string;
}

export interface ConflictContext {
  existing: readonly Booking[];
  turnoverMinutes: (roomId: string) => number;
  equipmentQuantity: (equipmentId: string) => number;
  absences: readonly Absence[];
  names: (userId: string) => string;
  equipmentName: (equipmentId: string) => string;
  workingHours?: { isWithin: (start: Date, end: Date) => boolean };
}

const MINUTE = 60_000;

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

function hhmm(d: Date) {
  return formatHospital(d, 'HH:mm');
}

// Intervals are half-open, so back-to-back cases do not overlap.
export function detectConflicts(candidate: Candidate, ctx: ConflictContext): Conflict[] {
  if (candidate.end <= candidate.start) {
    return [{ kind: 'OUTSIDE_HOURS', message: 'Bitiş zamanı başlangıçtan sonra olmalıdır.', blocking: true }];
  }

  const conflicts: Conflict[] = [];
  const others = ctx.existing.filter((b) => b.id !== candidate.id);
  const turnover = ctx.turnoverMinutes(candidate.roomId) * MINUTE;

  for (const other of others) {
    if (other.roomId === candidate.roomId) {
      if (overlaps(candidate.start, candidate.end, other.start, other.end)) {
        conflicts.push({
          kind: 'ROOM',
          surgeryId: other.id,
          message: `Salon bu saatte dolu: ${other.label} (${hhmm(other.start)}–${hhmm(other.end)})`,
          blocking: true,
        });
      } else {
        const candidateWithTurnover = new Date(candidate.end.getTime() + turnover);
        const otherWithTurnover = new Date(other.end.getTime() + turnover);
        if (
          overlaps(candidate.start, candidateWithTurnover, other.start, otherWithTurnover)
        ) {
          conflicts.push({
            kind: 'TURNOVER',
            surgeryId: other.id,
            message: `Salon temizlik süresi (${turnover / MINUTE} dk) ile çakışıyor: ${other.label}`,
            blocking: true,
          });
        }
      }
    }

    if (!overlaps(candidate.start, candidate.end, other.start, other.end)) continue;

    if (other.surgeonId === candidate.surgeonId) {
      conflicts.push({
        kind: 'SURGEON',
        surgeryId: other.id,
        userId: candidate.surgeonId,
        message: `${ctx.names(candidate.surgeonId)} aynı saatte başka bir ameliyatta: ${other.label}`,
        blocking: true,
      });
    }

    if (candidate.anesthetistId && other.anesthetistId === candidate.anesthetistId) {
      conflicts.push({
        kind: 'ANESTHETIST',
        surgeryId: other.id,
        userId: candidate.anesthetistId,
        message: `${ctx.names(candidate.anesthetistId)} aynı saatte başka bir ameliyatta: ${other.label}`,
        blocking: true,
      });
    }

    const otherPeople = new Set([other.surgeonId, other.anesthetistId, ...other.teamIds]);
    for (const memberId of candidate.teamIds) {
      if (otherPeople.has(memberId)) {
        conflicts.push({
          kind: 'TEAM_MEMBER',
          surgeryId: other.id,
          userId: memberId,
          message: `${ctx.names(memberId)} aynı saatte başka bir ekipte: ${other.label}`,
          blocking: true,
        });
      }
    }
  }

  for (const equipmentId of new Set(candidate.equipmentIds)) {
    const users = others.filter(
      (b) => b.equipmentIds.includes(equipmentId) && overlaps(candidate.start, candidate.end, b.start, b.end),
    );
    const peak = peakConcurrency(users, candidate.start, candidate.end);
    const quantity = ctx.equipmentQuantity(equipmentId);
    if (peak >= quantity) {
      conflicts.push({
        kind: 'EQUIPMENT',
        equipmentId,
        message: `${ctx.equipmentName(equipmentId)} bu saatte müsait değil (${quantity} adetin tamamı kullanımda)`,
        blocking: true,
      });
    }
  }

  const people = new Set([candidate.surgeonId, candidate.anesthetistId, ...candidate.teamIds].filter(Boolean) as string[]);
  for (const absence of ctx.absences) {
    if (people.has(absence.userId) && overlaps(candidate.start, candidate.end, absence.start, absence.end)) {
      conflicts.push({
        kind: 'UNAVAILABLE',
        userId: absence.userId,
        message: `${ctx.names(absence.userId)} bu tarihte müsait değil (${absence.reason})`,
        blocking: true,
      });
    }
  }

  if (ctx.workingHours && !ctx.workingHours.isWithin(candidate.start, candidate.end)) {
    conflicts.push({
      kind: 'OUTSIDE_HOURS',
      message: 'Vaka mesai saatleri dışına taşıyor.',
      blocking: false,
    });
  }

  return conflicts;
}

/** Highest number of bookings in use at the same instant within [from, to). */
export function peakConcurrency(bookings: readonly Pick<Booking, 'start' | 'end'>[], from: Date, to: Date): number {
  const points: Array<[number, number]> = [];
  for (const b of bookings) {
    const s = Math.max(b.start.getTime(), from.getTime());
    const e = Math.min(b.end.getTime(), to.getTime());
    if (s < e) {
      points.push([s, 1], [e, -1]);
    }
  }
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let current = 0;
  let peak = 0;
  for (const [, delta] of points) {
    current += delta;
    peak = Math.max(peak, current);
  }
  return peak;
}
