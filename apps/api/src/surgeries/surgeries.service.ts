import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ACTIVE_STATUSES,
  allowedTransitions,
  checklistTemplate,
  Conflict,
  findTransition,
  hasPermission,
  Permission,
  Role,
  SurgeryStatus,
  surgeryStatusLabels,
  teamRoleLabels,
  TeamRole,
  WORKING_HOURS,
} from '@surgiplan/shared';
import { addMinutes, subMinutes } from 'date-fns';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { formatHospital, hospitalDate, hospitalHour } from '../common/time';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Booking, Candidate, detectConflicts } from './conflicts';
import { lockResources } from './resource-lock';
import { AccessScope, canActOn, canRead, mineFilter, visibilityFilter } from './surgery-access';
import {
  ConflictPreviewDto,
  CreateSurgeryDto,
  ListSurgeriesQuery,
  ScheduleDto,
  TransitionDto,
  UpdateSurgeryDto,
} from './surgeries.dto';

const LOOKAROUND_MINUTES = 12 * 60;

const listInclude = {
  patient: { select: { id: true, mrn: true, firstName: true, lastName: true, birthDate: true, gender: true } },
  procedure: { select: { id: true, code: true, name: true } },
  room: { select: { id: true, code: true, name: true } },
  surgeon: { select: { id: true, fullName: true, title: true } },
  anesthetist: { select: { id: true, fullName: true, title: true } },
  team: { select: { userId: true, role: true, user: { select: { fullName: true, title: true } } } },
  equipment: { select: { equipmentId: true, equipment: { select: { name: true } } } },
} satisfies Prisma.SurgeryInclude;

const detailInclude = {
  ...listInclude,
  patient: true,
  procedure: { include: { branch: true } },
  createdBy: { select: { id: true, fullName: true } },
  checklist: { include: { checkedBy: { select: { id: true, fullName: true } } } },
  events: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, fullName: true, role: true } } } },
} satisfies Prisma.SurgeryInclude;

type SurgeryWithRelations = Prisma.SurgeryGetPayload<{ include: typeof listInclude }>;

const EDITABLE_STATUSES: readonly string[] = [SurgeryStatus.Draft, SurgeryStatus.PendingApproval, SurgeryStatus.Postponed];
const SCHEDULABLE_STATUSES: readonly string[] = [SurgeryStatus.PendingApproval, SurgeryStatus.Scheduled, SurgeryStatus.Postponed];

@Injectable()
export class SurgeriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async scope(user: AuthUser): Promise<AccessScope> {
    if (user.role !== Role.Assistant) return { user, supervisorId: null };
    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { supervisorId: true } });
    return { user, supervisorId: me?.supervisorId ?? null };
  }

  async list(user: AuthUser, query: ListSurgeriesQuery) {
    const scope = await this.scope(user);
    const filters: Prisma.SurgeryWhereInput[] = [];
    const visibility = visibilityFilter(scope);
    if (visibility) filters.push(visibility);
    if (query.mine) filters.push(mineFilter(scope));
    if (query.from || query.to) {
      filters.push({
        OR: [
          { plannedStart: { gte: query.from ? new Date(query.from) : undefined, lt: query.to ? new Date(query.to) : undefined } },
          {
            plannedStart: null,
            requestedDate: { gte: query.from ? new Date(query.from) : undefined, lt: query.to ? new Date(query.to) : undefined },
          },
        ],
      });
    }
    if (query.q) {
      filters.push({
        OR: [
          { patient: { mrn: { contains: query.q } } },
          { patient: { lastName: { contains: query.q } } },
          { patient: { firstName: { contains: query.q } } },
          { procedure: { name: { contains: query.q } } },
        ],
      });
    }

    const items = await this.prisma.surgery.findMany({
      where: {
        AND: filters,
        roomId: query.roomId,
        surgeonId: query.surgeonId,
        status: query.status?.length ? { in: query.status } : undefined,
      },
      include: listInclude,
      orderBy: [{ plannedStart: 'asc' }, { requestedDate: 'asc' }, { createdAt: 'asc' }],
      take: query.take ?? 300,
    });
    return items.map((s) => this.present(s));
  }

  async get(user: AuthUser, id: string) {
    const scope = await this.scope(user);
    const surgery = await this.prisma.surgery.findUnique({ where: { id }, include: detailInclude });
    if (!surgery || !canRead(scope, surgery)) throw new NotFoundException('Ameliyat kaydı bulunamadı.');

    const template = new Map(checklistTemplate.map((t) => [t.key, t]));
    return {
      ...this.present(surgery),
      patient: surgery.patient,
      procedure: surgery.procedure,
      createdBy: surgery.createdBy,
      events: surgery.events,
      checklist: surgery.checklist
        .filter((c) => template.has(c.key))
        .sort((a, b) => checklistTemplate.findIndex((t) => t.key === a.key) - checklistTemplate.findIndex((t) => t.key === b.key))
        .map((c) => ({ ...c, phase: template.get(c.key)!.phase, text: template.get(c.key)!.text })),
      allowedTransitions: canActOn(scope, surgery) ? allowedTransitions(surgery.status as SurgeryStatus, user.role) : [],
      canEdit: EDITABLE_STATUSES.includes(surgery.status) && canActOn(scope, surgery) && hasPermission(user.role, Permission.SurgeriesCreate),
      canSchedule: SCHEDULABLE_STATUSES.includes(surgery.status) && hasPermission(user.role, Permission.SurgeriesSchedule),
    };
  }

  async create(user: AuthUser, dto: CreateSurgeryDto) {
    const scope = await this.scope(user);
    const surgeonId = this.resolveSurgeon(scope, dto.surgeonId);
    const surgeon = await this.prisma.user.findUnique({ where: { id: surgeonId } });
    if (!surgeon || surgeon.role !== Role.Surgeon || !surgeon.isActive) {
      throw new BadRequestException('Geçerli bir operatör hekim seçin.');
    }

    const procedure = await this.prisma.procedure.findUnique({ where: { id: dto.procedureId } });
    if (!procedure) throw new BadRequestException('İşlem bulunamadı.');

    // Assistants prepare drafts; the responsible surgeon submits them.
    const status = dto.submit && user.role !== Role.Assistant ? SurgeryStatus.PendingApproval : SurgeryStatus.Draft;
    const estimate = dto.estimatedMinutes ?? (await this.estimate(dto.procedureId, surgeonId)).minutes;

    const created = await this.prisma.$transaction(async (tx) => {
      const surgery = await tx.surgery.create({
        data: {
          patientId: dto.patientId,
          procedureId: dto.procedureId,
          surgeonId,
          anesthetistId: dto.anesthetistId ?? null,
          createdById: user.id,
          status,
          priority: dto.priority,
          anesthesiaType: dto.anesthesiaType,
          laterality: dto.laterality,
          estimatedMinutes: estimate,
          requestedDate: dto.requestedDate ? new Date(dto.requestedDate) : null,
          diagnosis: dto.diagnosis,
          notes: dto.notes,
          team: { create: (dto.team ?? []).map((m) => ({ userId: m.userId, role: m.role })) },
          equipment: { create: (dto.equipmentIds ?? []).map((equipmentId) => ({ equipmentId })) },
          checklist: { create: checklistTemplate.map((item) => ({ key: item.key })) },
          events: { create: { actorId: user.id, type: 'CREATED', toStatus: status } },
        },
        include: listInclude,
      });
      await this.audit.record({ actorId: user.id, action: 'surgery.created', entity: 'surgery', entityId: surgery.id, changes: { status } }, tx);

      if (status === SurgeryStatus.PendingApproval) {
        await this.notifyCoordinators(tx, surgery, user.id);
      } else if (user.role === Role.Assistant) {
        await this.notifications.notify(tx, [surgeonId], {
          type: 'surgery.draft',
          title: 'Onayınızı bekleyen taslak',
          body: `${surgery.procedure.name} için asistanınız bir talep taslağı hazırladı.`,
          link: `/surgeries/${surgery.id}`,
        });
      }
      return surgery;
    });

    this.realtime.notifyUsers([surgeonId]);
    return this.present(created);
  }

  async update(user: AuthUser, id: string, dto: UpdateSurgeryDto) {
    const scope = await this.scope(user);
    const existing = await this.loadForWrite(scope, id);
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new UnprocessableEntityException('Planlanmış bir vakanın detayları koordinatör tarafından yeniden planlanarak değiştirilebilir.');
    }

    const { version, team, equipmentIds, requestedDate, ...fields } = dto;
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.bumpVersion(tx, id, version, {
        ...fields,
        requestedDate: requestedDate === undefined ? undefined : new Date(requestedDate),
      });
      if (team) {
        await tx.surgeryTeamMember.deleteMany({ where: { surgeryId: id } });
        await tx.surgeryTeamMember.createMany({ data: team.map((m) => ({ surgeryId: id, userId: m.userId, role: m.role })) });
      }
      if (equipmentIds) {
        await tx.surgeryEquipment.deleteMany({ where: { surgeryId: id } });
        await tx.surgeryEquipment.createMany({ data: equipmentIds.map((equipmentId) => ({ surgeryId: id, equipmentId })) });
      }
      await tx.surgeryEvent.create({ data: { surgeryId: id, actorId: user.id, type: 'UPDATED' } });
      await this.audit.record({ actorId: user.id, action: 'surgery.updated', entity: 'surgery', entityId: id, changes: dto }, tx);
      return tx.surgery.findUniqueOrThrow({ where: { id }, include: listInclude });
    });
    return this.present(updated);
  }

  async previewConflicts(user: AuthUser, dto: ConflictPreviewDto) {
    const start = new Date(dto.plannedStart);
    const candidate: Candidate = {
      id: dto.surgeryId,
      roomId: dto.roomId,
      start,
      end: addMinutes(start, dto.durationMinutes),
      surgeonId: dto.surgeonId,
      anesthetistId: dto.anesthetistId ?? null,
      teamIds: dto.teamIds ?? [],
      equipmentIds: dto.equipmentIds ?? [],
    };
    void user;
    return { conflicts: await this.findConflicts(this.prisma, candidate) };
  }

  async schedule(user: AuthUser, id: string, dto: ScheduleDto) {
    const start = new Date(dto.plannedStart);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.surgery.findUnique({ where: { id }, include: listInclude });
        if (!current) throw new NotFoundException('Ameliyat kaydı bulunamadı.');
        if (!SCHEDULABLE_STATUSES.includes(current.status)) {
          throw new UnprocessableEntityException(`"${surgeryStatusLabels[current.status as SurgeryStatus]}" durumundaki bir vaka planlanamaz.`);
        }
        if (current.version !== dto.version) throw this.staleError();

        const duration = dto.durationMinutes ?? current.estimatedMinutes;
        const candidate: Candidate = {
          id,
          roomId: dto.roomId,
          start,
          end: addMinutes(start, duration),
          surgeonId: current.surgeonId,
          anesthetistId: dto.anesthetistId ?? current.anesthetistId,
          teamIds: current.team.map((t) => t.userId),
          equipmentIds: current.equipment.map((e) => e.equipmentId),
        };

        await lockResources(tx, [
          `room:${candidate.roomId}`,
          `user:${candidate.surgeonId}`,
          ...(candidate.anesthetistId ? [`user:${candidate.anesthetistId}`] : []),
          ...candidate.teamIds.map((u) => `user:${u}`),
          ...candidate.equipmentIds.map((e) => `equipment:${e}`),
        ]);

        const conflicts = await this.findConflicts(tx, candidate);
        const blocking = conflicts.filter((c) => c.blocking);
        if (blocking.length || (conflicts.length && !dto.acknowledgeWarnings)) {
          throw new ConflictException({ message: 'Planlama çakışması var.', conflicts });
        }

        const wasScheduled = current.status === SurgeryStatus.Scheduled && current.plannedStart;
        await this.bumpVersion(tx, id, dto.version, {
          roomId: candidate.roomId,
          plannedStart: candidate.start,
          plannedEnd: candidate.end,
          estimatedMinutes: duration,
          anesthetistId: candidate.anesthetistId,
          status: SurgeryStatus.Scheduled,
          statusReason: null,
        });

        const updated = await tx.surgery.findUniqueOrThrow({ where: { id }, include: listInclude });
        const note = `${updated.room!.code} · ${formatHospital(candidate.start)}`;
        await tx.surgeryEvent.create({
          data: {
            surgeryId: id,
            actorId: user.id,
            type: wasScheduled ? 'RESCHEDULED' : 'SCHEDULED',
            fromStatus: current.status,
            toStatus: SurgeryStatus.Scheduled,
            note,
          },
        });
        await this.audit.record(
          {
            actorId: user.id,
            action: wasScheduled ? 'surgery.rescheduled' : 'surgery.scheduled',
            entity: 'surgery',
            entityId: id,
            changes: {
              room: { from: current.room?.code ?? null, to: updated.room?.code },
              plannedStart: { from: current.plannedStart, to: candidate.start },
              durationMinutes: { from: current.estimatedMinutes, to: duration },
            },
          },
          tx,
        );

        if (wasScheduled) {
          await this.notifications.notify(
            tx,
            this.participants(updated),
            {
              type: 'surgery.rescheduled',
              title: 'Vaka planı değişti',
              body: `${updated.procedure.name}: ${note}`,
              link: `/surgeries/${id}`,
              email: {
                subject: `Plan değişikliği: ${updated.procedure.name}`,
                template: 'surgery-updated',
                data: {
                  procedure: updated.procedure.name,
                  previous: `${current.room?.code ?? '-'} · ${formatHospital(current.plannedStart!)}`,
                  current: note,
                },
              },
            },
            user.id,
          );
        } else {
          await this.notifyAssignment(tx, updated, user.id);
        }
        return { surgery: updated, conflicts };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
    );

    this.realtime.surgeryChanged({ surgeryId: id, roomId: result.surgery.roomId, status: result.surgery.status });
    this.realtime.notifyUsers(this.participants(result.surgery));
    return { surgery: this.present(result.surgery), warnings: result.conflicts };
  }

  async transition(user: AuthUser, id: string, dto: TransitionDto) {
    const scope = await this.scope(user);
    const current = await this.loadForWrite(scope, id, true);
    const from = current.status as SurgeryStatus;
    const transition = findTransition(from, dto.to);

    if (!transition) {
      throw new UnprocessableEntityException(`"${surgeryStatusLabels[from]}" durumundan "${surgeryStatusLabels[dto.to]}" durumuna geçilemez.`);
    }
    if (!transition.roles.includes(user.role)) throw new ForbiddenException('Bu durum değişikliği için yetkiniz yok.');
    if (transition.requiresReason && !dto.reason?.trim()) throw new BadRequestException('Bu işlem için gerekçe girilmelidir.');

    if (dto.to === SurgeryStatus.InProgress || dto.to === SurgeryStatus.Completed) {
      const phases = dto.to === SurgeryStatus.InProgress ? ['SIGN_IN', 'TIME_OUT'] : ['SIGN_IN', 'TIME_OUT', 'SIGN_OUT'];
      const required = checklistTemplate.filter((t) => phases.includes(t.phase)).map((t) => t.key);
      const missing = await this.prisma.checklistItem.count({ where: { surgeryId: id, key: { in: required }, checked: false } });
      if (missing > 0) {
        throw new UnprocessableEntityException(`Güvenli cerrahi kontrol listesinde ${missing} madde tamamlanmamış.`);
      }
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.bumpVersion(tx, id, dto.version, {
        status: dto.to,
        statusReason: dto.reason?.trim() || null,
        actualStart: dto.to === SurgeryStatus.InProgress ? now : undefined,
        actualEnd: dto.to === SurgeryStatus.Completed ? now : undefined,
      });
      await tx.surgeryEvent.create({
        data: { surgeryId: id, actorId: user.id, type: 'STATUS', fromStatus: from, toStatus: dto.to, note: dto.reason?.trim() },
      });
      await this.audit.record(
        { actorId: user.id, action: 'surgery.status_changed', entity: 'surgery', entityId: id, changes: { status: { from, to: dto.to }, reason: dto.reason } },
        tx,
      );

      const surgery = await tx.surgery.findUniqueOrThrow({ where: { id }, include: listInclude });
      await this.notifyTransition(tx, surgery, from, dto, user);
      return surgery;
    });

    this.realtime.surgeryChanged({ surgeryId: id, roomId: updated.roomId, status: updated.status });
    this.realtime.notifyUsers(this.participants(updated));
    return this.present(updated);
  }

  async updateChecklist(user: AuthUser, id: string, key: string, checked: boolean) {
    const scope = await this.scope(user);
    const surgery = await this.loadForWrite(scope, id, true);
    const editable: readonly string[] = [SurgeryStatus.Scheduled, SurgeryStatus.Preparing, SurgeryStatus.InProgress];
    if (!editable.includes(surgery.status)) {
      throw new UnprocessableEntityException('Kontrol listesi yalnızca planlanmış ve devam eden vakalarda güncellenebilir.');
    }
    if (!checklistTemplate.some((t) => t.key === key)) throw new NotFoundException('Kontrol maddesi bulunamadı.');

    const item = await this.prisma.checklistItem.upsert({
      where: { surgeryId_key: { surgeryId: id, key } },
      create: { surgeryId: id, key, checked, checkedById: checked ? user.id : null, checkedAt: checked ? new Date() : null },
      update: { checked, checkedById: checked ? user.id : null, checkedAt: checked ? new Date() : null },
      include: { checkedBy: { select: { id: true, fullName: true } } },
    });
    await this.audit.record({ actorId: user.id, action: checked ? 'checklist.checked' : 'checklist.unchecked', entity: 'surgery', entityId: id, changes: { key } });
    this.realtime.surgeryChanged({ surgeryId: id, roomId: surgery.roomId, status: surgery.status });
    return item;
  }

  /** Average of recent real durations; falls back to the procedure's catalogue time. */
  async estimate(procedureId: string, surgeonId?: string) {
    const recent = (where: Prisma.SurgeryWhereInput) =>
      this.prisma.surgery.findMany({
        where: { procedureId, status: SurgeryStatus.Completed, actualStart: { not: null }, actualEnd: { not: null }, ...where },
        select: { actualStart: true, actualEnd: true },
        orderBy: { actualEnd: 'desc' },
        take: 20,
      });

    const average = (rows: Array<{ actualStart: Date | null; actualEnd: Date | null }>) =>
      rows.reduce((sum, r) => sum + (r.actualEnd!.getTime() - r.actualStart!.getTime()) / 60_000, 0) / rows.length;
    const roundToSlot = (m: number) => Math.max(15, Math.ceil(m / 5) * 5);

    if (surgeonId) {
      const own = await recent({ surgeonId });
      if (own.length >= 3) return { minutes: roundToSlot(average(own)), basis: 'SURGEON', sampleSize: own.length };
    }
    const all = await recent({});
    if (all.length >= 3) return { minutes: roundToSlot(average(all)), basis: 'PROCEDURE', sampleSize: all.length };

    const procedure = await this.prisma.procedure.findUniqueOrThrow({ where: { id: procedureId } });
    return { minutes: procedure.defaultDurationMinutes, basis: 'CATALOG', sampleSize: 0 };
  }

  private async findConflicts(db: Tx, candidate: Candidate): Promise<Conflict[]> {
    const windowStart = subMinutes(candidate.start, LOOKAROUND_MINUTES);
    const windowEnd = addMinutes(candidate.end, LOOKAROUND_MINUTES);
    const people = [candidate.surgeonId, candidate.anesthetistId, ...candidate.teamIds].filter(Boolean) as string[];

    const [existing, rooms, equipment, absences, users] = await Promise.all([
      db.surgery.findMany({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          plannedStart: { lt: windowEnd },
          plannedEnd: { gt: windowStart },
        },
        include: { procedure: { select: { name: true } }, team: true, equipment: true },
      }),
      db.room.findMany({ select: { id: true, turnoverMinutes: true } }),
      db.equipment.findMany({ select: { id: true, name: true, quantity: true } }),
      db.unavailability.findMany({
        where: { userId: { in: people }, startsAt: { lt: candidate.end }, endsAt: { gt: candidate.start } },
      }),
      db.user.findMany({ where: { id: { in: people } }, select: { id: true, fullName: true, title: true } }),
    ]);

    const bookings: Booking[] = existing.map((s) => ({
      id: s.id,
      label: s.procedure.name,
      roomId: s.roomId,
      start: s.actualStart ?? s.plannedStart!,
      end: s.actualEnd ?? (s.status === SurgeryStatus.InProgress && s.plannedEnd! < new Date() ? new Date() : s.plannedEnd!),
      surgeonId: s.surgeonId,
      anesthetistId: s.anesthetistId,
      teamIds: s.team.map((t) => t.userId),
      equipmentIds: s.equipment.map((e) => e.equipmentId),
    }));

    const turnover = new Map(rooms.map((r) => [r.id, r.turnoverMinutes]));
    const equipmentById = new Map(equipment.map((e) => [e.id, e]));
    const names = new Map(users.map((u) => [u.id, [u.title, u.fullName].filter(Boolean).join(' ')]));
    const absenceLabels: Record<string, string> = { LEAVE: 'izinli', DUTY: 'nöbet ertesi', CONGRESS: 'kongrede', OTHER: 'müsait değil' };

    return detectConflicts(candidate, {
      existing: bookings,
      turnoverMinutes: (id) => turnover.get(id) ?? 30,
      equipmentQuantity: (id) => equipmentById.get(id)?.quantity ?? 1,
      equipmentName: (id) => equipmentById.get(id)?.name ?? 'Ekipman',
      names: (id) => names.get(id) ?? 'Ekip üyesi',
      absences: absences.map((a) => ({ userId: a.userId, start: a.startsAt, end: a.endsAt, reason: a.note || absenceLabels[a.kind] || a.kind })),
      workingHours: {
        isWithin: (start, end) =>
          hospitalDate(start) === hospitalDate(end) &&
          hospitalHour(start) >= WORKING_HOURS.start &&
          hospitalHour(end) <= WORKING_HOURS.end,
      },
    });
  }

  private resolveSurgeon(scope: AccessScope, requested?: string): string {
    const { user } = scope;
    if (user.role === Role.Surgeon) return user.id;
    if (user.role === Role.Assistant) {
      if (!scope.supervisorId) throw new BadRequestException('Hesabınıza bağlı bir sorumlu hekim tanımlı değil.');
      return scope.supervisorId;
    }
    if (!requested) throw new BadRequestException('Operatör hekim seçilmelidir.');
    return requested;
  }

  private async loadForWrite(scope: AccessScope, id: string, allowFloorRoles = false) {
    const surgery = await this.prisma.surgery.findUnique({ where: { id }, include: { team: { select: { userId: true } } } });
    if (!surgery || !canRead(scope, surgery)) throw new NotFoundException('Ameliyat kaydı bulunamadı.');
    if (!canActOn(scope, surgery)) throw new ForbiddenException('Bu vaka üzerinde işlem yetkiniz yok.');
    if (!allowFloorRoles && !hasPermission(scope.user.role, Permission.SurgeriesCreate)) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    }
    return surgery;
  }

  private async bumpVersion(tx: Tx, id: string, version: number, data: Prisma.SurgeryUncheckedUpdateManyInput) {
    const result = await tx.surgery.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count === 0) throw this.staleError();
  }

  private staleError() {
    return new ConflictException({
      message: 'Bu kayıt siz düzenlerken başka bir kullanıcı tarafından değiştirildi. Sayfayı yenileyip tekrar deneyin.',
      code: 'STALE_VERSION',
    });
  }

  private participants(s: SurgeryWithRelations): string[] {
    return [s.surgeonId, s.anesthetistId, ...s.team.map((t) => t.userId)].filter(Boolean) as string[];
  }

  private patientShort(s: SurgeryWithRelations) {
    return `${s.patient.firstName} ${s.patient.lastName.charAt(0)}. (${s.patient.mrn})`;
  }

  private async notifyAssignment(tx: Tx, s: SurgeryWithRelations, actorId: string) {
    const when = formatHospital(s.plannedStart!, "d MMMM yyyy, EEEE 'saat' HH:mm");
    const base = {
      procedure: s.procedure.name,
      when,
      room: s.room ? `${s.room.code} · ${s.room.name}` : '-',
      duration: s.estimatedMinutes,
      surgeon: [s.surgeon.title, s.surgeon.fullName].filter(Boolean).join(' '),
      patient: this.patientShort(s),
    };
    const groups: Array<[string[], string]> = [
      [[s.surgeonId], 'operatör hekim'],
      [s.anesthetistId ? [s.anesthetistId] : [], 'anestezi uzmanı'],
      ...Object.values(TeamRole).map(
        (role): [string[], string] => [s.team.filter((t) => t.role === role).map((t) => t.userId), teamRoleLabels[role].toLowerCase()],
      ),
    ];
    for (const [ids, assignment] of groups) {
      await this.notifications.notify(
        tx,
        ids,
        {
          type: 'surgery.scheduled',
          title: 'Yeni vaka ataması',
          body: `${s.procedure.name} · ${s.room?.code} · ${when}`,
          link: `/surgeries/${s.id}`,
          email: { subject: `Ameliyat planlandı: ${s.procedure.name}`, template: 'surgery-assigned', data: { ...base, assignment } },
        },
        actorId,
      );
    }
  }

  private async notifyTransition(tx: Tx, s: SurgeryWithRelations, from: SurgeryStatus, dto: TransitionDto, actor: AuthUser) {
    if (dto.to === SurgeryStatus.PendingApproval) {
      await this.notifyCoordinators(tx, s, actor.id);
      return;
    }
    if (dto.to === SurgeryStatus.Draft) {
      await this.notifications.notify(tx, [s.surgeonId], {
        type: 'surgery.returned',
        title: 'Talep düzeltme için geri gönderildi',
        body: dto.reason,
        link: `/surgeries/${s.id}`,
      });
      return;
    }
    if (dto.to === SurgeryStatus.Cancelled || dto.to === SurgeryStatus.Postponed) {
      const actorName = (await tx.user.findUnique({ where: { id: actor.id }, select: { fullName: true } }))?.fullName ?? '';
      const label = surgeryStatusLabels[dto.to];
      const wasBooked = from === SurgeryStatus.Scheduled || from === SurgeryStatus.Preparing;
      await this.notifications.notify(
        tx,
        wasBooked ? this.participants(s) : [s.surgeonId],
        {
          type: `surgery.${dto.to.toLowerCase()}`,
          title: `Vaka ${label.toLowerCase()}`,
          body: `${s.procedure.name}: ${dto.reason}`,
          link: `/surgeries/${s.id}`,
          email: wasBooked
            ? {
                subject: `${label}: ${s.procedure.name}`,
                template: 'surgery-cancelled',
                data: {
                  procedure: s.procedure.name,
                  statusLabel: label,
                  statusLabelLower: label.toLocaleLowerCase('tr-TR'),
                  when: s.plannedStart ? formatHospital(s.plannedStart) : '-',
                  reason: dto.reason,
                  actor: actorName,
                },
              }
            : undefined,
        },
        actor.id,
      );
    }
  }

  private async notifyCoordinators(tx: Tx, s: SurgeryWithRelations, actorId: string) {
    const coordinators = await tx.user.findMany({ where: { role: Role.Coordinator, isActive: true }, select: { id: true } });
    await this.notifications.notify(
      tx,
      coordinators.map((c) => c.id),
      {
        type: 'surgery.pending',
        title: 'Onay bekleyen yeni talep',
        body: `${[s.surgeon.title, s.surgeon.fullName].filter(Boolean).join(' ')} · ${s.procedure.name}`,
        link: `/requests`,
      },
      actorId,
    );
  }

  private present(s: SurgeryWithRelations) {
    return {
      id: s.id,
      number: s.number,
      status: s.status as SurgeryStatus,
      priority: s.priority,
      anesthesiaType: s.anesthesiaType,
      laterality: s.laterality,
      estimatedMinutes: s.estimatedMinutes,
      requestedDate: s.requestedDate,
      plannedStart: s.plannedStart,
      plannedEnd: s.plannedEnd,
      actualStart: s.actualStart,
      actualEnd: s.actualEnd,
      diagnosis: s.diagnosis,
      notes: s.notes,
      statusReason: s.statusReason,
      version: s.version,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      patient: s.patient,
      procedure: s.procedure,
      room: s.room,
      surgeon: s.surgeon,
      anesthetist: s.anesthetist,
      team: s.team.map((t) => ({ userId: t.userId, role: t.role, fullName: t.user.fullName, title: t.user.title })),
      equipment: s.equipment.map((e) => ({ id: e.equipmentId, name: e.equipment.name })),
    };
  }
}
