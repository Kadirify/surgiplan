import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoomLiveState, SurgeryStatus } from '@surgiplan/shared';
import { addMinutes } from 'date-fns';
import { hospitalDate, hospitalDayRange } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('board')
@ApiBearerAuth()
@Controller('board')
export class BoardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async snapshot() {
    const now = new Date();
    const { from, to } = hospitalDayRange(hospitalDate(now));

    const [rooms, surgeries] = await Promise.all([
      this.prisma.room.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      this.prisma.surgery.findMany({
        where: {
          plannedStart: { gte: from, lt: to },
          status: { in: [SurgeryStatus.Scheduled, SurgeryStatus.Preparing, SurgeryStatus.InProgress, SurgeryStatus.Completed] },
        },
        orderBy: { plannedStart: 'asc' },
        include: {
          procedure: { select: { name: true } },
          surgeon: { select: { fullName: true, title: true } },
          patient: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    return {
      generatedAt: now,
      rooms: rooms.map((room) => {
        const cases = surgeries.filter((s) => s.roomId === room.id);
        const active = cases.find((s) => s.status === SurgeryStatus.InProgress) ?? cases.find((s) => s.status === SurgeryStatus.Preparing);
        const lastDone = [...cases].reverse().find((s) => s.status === SurgeryStatus.Completed && s.actualEnd);
        const cleaningUntil = lastDone?.actualEnd ? addMinutes(lastDone.actualEnd, room.turnoverMinutes) : null;
        const next = cases.find((s) => s.status === SurgeryStatus.Scheduled && s.id !== active?.id);

        let state: RoomLiveState = 'IDLE';
        if (active?.status === SurgeryStatus.InProgress) state = 'IN_PROGRESS';
        else if (active?.status === SurgeryStatus.Preparing) state = 'PREPARING';
        else if (cleaningUntil && cleaningUntil > now) state = 'CLEANING';

        // The board hangs on corridor screens, so patient names are reduced to initials.
        const view = (s?: typeof cases[number]) =>
          s && {
            id: s.id,
            procedure: s.procedure.name,
            surgeon: [s.surgeon.title, s.surgeon.fullName].filter(Boolean).join(' '),
            patientInitials: `${s.patient.firstName.charAt(0)}. ${s.patient.lastName.charAt(0)}.`,
            plannedStart: s.plannedStart,
            plannedEnd: s.plannedEnd,
            actualStart: s.actualStart,
            estimatedMinutes: s.estimatedMinutes,
            status: s.status,
          };

        return {
          id: room.id,
          code: room.code,
          name: room.name,
          state,
          cleaningUntil: state === 'CLEANING' ? cleaningUntil : null,
          current: view(active),
          next: view(next),
          completedCount: cases.filter((s) => s.status === SurgeryStatus.Completed).length,
          totalCount: cases.length,
        };
      }),
    };
  }
}
