import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { addDays, addMinutes, startOfDay } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import { checklistTemplate, HOSPITAL_TIME_ZONE, Role, SurgeryStatus } from '@surgiplan/shared';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo1234!';
const LAST_START_HOUR = 17;

const branches = ['Genel Cerrahi', 'Ortopedi', 'Kadın Hastalıkları ve Doğum', 'Kulak Burun Boğaz', 'Üroloji', 'Beyin Cerrahisi'];

const rooms = [
  { code: 'AH-1', name: 'Ameliyathane 1', floor: '2. Kat', turnoverMinutes: 30 },
  { code: 'AH-2', name: 'Ameliyathane 2', floor: '2. Kat', turnoverMinutes: 30 },
  { code: 'AH-3', name: 'Ameliyathane 3', floor: '2. Kat', turnoverMinutes: 30 },
  { code: 'AH-4', name: 'Ameliyathane 4', floor: '2. Kat', turnoverMinutes: 45 },
  { code: 'AH-5', name: 'Ameliyathane 5 (Hibrit)', floor: '3. Kat', turnoverMinutes: 45 },
  { code: 'AH-6', name: 'Günübirlik Cerrahi', floor: '1. Kat', turnoverMinutes: 20 },
];

const equipment = [
  { code: 'C-ARM', name: 'C-kollu skopi', quantity: 3 },
  { code: 'LAP-TWR', name: 'Laparoskopi kulesi', quantity: 3 },
  { code: 'MICRO', name: 'Operasyon mikroskobu', quantity: 1 },
  { code: 'NAV', name: 'Nöronavigasyon', quantity: 1 },
  { code: 'ARTHRO', name: 'Artroskopi seti', quantity: 2 },
  { code: 'LIGASURE', name: 'Damar mühürleme cihazı', quantity: 2 },
];

const procedures: Array<[string, string, string, number]> = [
  ['GC-001', 'Laparoskopik kolesistektomi', 'Genel Cerrahi', 75],
  ['GC-002', 'Laparoskopik apendektomi', 'Genel Cerrahi', 60],
  ['GC-003', 'İnguinal herni onarımı', 'Genel Cerrahi', 60],
  ['GC-004', 'Tiroidektomi', 'Genel Cerrahi', 120],
  ['OR-001', 'Total diz protezi', 'Ortopedi', 120],
  ['OR-002', 'Artroskopik menisektomi', 'Ortopedi', 60],
  ['OR-003', 'Kalça kırığı - parsiyel protez', 'Ortopedi', 105],
  ['KD-001', 'Sezaryen', 'Kadın Hastalıkları ve Doğum', 60],
  ['KD-002', 'Laparoskopik histerektomi', 'Kadın Hastalıkları ve Doğum', 150],
  ['KD-003', 'Histeroskopi', 'Kadın Hastalıkları ve Doğum', 40],
  ['KB-001', 'Septoplasti', 'Kulak Burun Boğaz', 60],
  ['KB-002', 'Tonsillektomi', 'Kulak Burun Boğaz', 45],
  ['KB-003', 'Endoskopik sinüs cerrahisi', 'Kulak Burun Boğaz', 90],
  ['UR-001', 'TUR-P', 'Üroloji', 75],
  ['UR-002', 'Üreterorenoskopi', 'Üroloji', 60],
  ['UR-003', 'Sistoskopi ve biyopsi', 'Üroloji', 30],
  ['BC-001', 'Lomber mikrodiskektomi', 'Beyin Cerrahisi', 90],
  ['BC-002', 'Servikal diskektomi ve füzyon', 'Beyin Cerrahisi', 150],
];

const procedureEquipment: Record<string, string[]> = {
  'GC-001': ['LAP-TWR', 'LIGASURE'],
  'GC-002': ['LAP-TWR'],
  'KD-002': ['LAP-TWR', 'LIGASURE'],
  'OR-003': ['C-ARM'],
  'OR-002': ['ARTHRO'],
  'UR-002': ['C-ARM'],
  'BC-001': ['MICRO', 'C-ARM'],
  'BC-002': ['MICRO', 'C-ARM'],
};

const lostReasons = {
  cancelled: ['Hasta ameliyata hazır değildi (açlık süresi yetersiz)', 'Hasta onam vermedi', 'Preoperatif tetkikte kontrendikasyon'],
  postponed: ['Yoğun bakım yatağı bulunamadı', 'Acil vaka nedeniyle', 'Kan ürünü hazır değil'],
};

const firstNames = ['Ayşe', 'Mehmet', 'Fatma', 'Mustafa', 'Emine', 'Ahmet', 'Hatice', 'Ali', 'Zeynep', 'Hüseyin', 'Elif', 'Hasan', 'Merve', 'İbrahim', 'Esra', 'Murat', 'Büşra', 'Ömer', 'Seda', 'Yusuf'];
const lastNames = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek'];

function pick<T>(list: readonly T[], i: number): T {
  return list[((i % list.length) + list.length) % list.length];
}

function hospitalTime(day: Date, hour: number, minute = 0): Date {
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(hour)}:${pad(minute)}:00`;
  return zonedTimeToUtc(iso, HOSPITAL_TIME_ZONE);
}

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const branchIds: string[] = [];
  for (const name of branches) {
    branchIds.push((await prisma.branch.create({ data: { name } })).id);
  }

  const roomRecords = [];
  for (const [i, r] of rooms.entries()) {
    roomRecords.push(await prisma.room.create({ data: { ...r, sortOrder: i } }));
  }

  const equipmentByCode = new Map<string, string>();
  for (const e of equipment) {
    equipmentByCode.set(e.code, (await prisma.equipment.create({ data: e })).id);
  }

  const proceduresByBranch = branches.map(() => [] as Array<{ id: string; code: string; defaultDurationMinutes: number }>);
  for (const [code, name, branch, minutes] of procedures) {
    const index = branches.indexOf(branch);
    const record = await prisma.procedure.create({
      data: { code, name, branchId: branchIds[index], defaultDurationMinutes: minutes },
    });
    proceduresByBranch[index].push(record);
  }

  const mkUser = (data: { email: string; fullName: string; role: Role; title?: string; branch?: number; supervisorId?: string }) =>
    prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        title: data.title,
        branchId: data.branch === undefined ? undefined : branchIds[data.branch],
        supervisorId: data.supervisorId,
        passwordHash,
      },
    });

  await mkUser({ email: 'admin@surgiplan.com', fullName: 'Sistem Yöneticisi', role: Role.Admin });
  const coordinator = await mkUser({ email: 'koordinator@surgiplan.com', fullName: 'Selin Aksoy', role: Role.Coordinator });
  await mkUser({ email: 'sekreter@surgiplan.com', fullName: 'Gamze Tunç', role: Role.Secretary });

  // One surgeon per branch, in the same order as `branches`.
  const surgeons = [
    await mkUser({ email: 'cerrah@surgiplan.com', fullName: 'Kemal Ertürk', role: Role.Surgeon, title: 'Op. Dr.', branch: 0 }),
    await mkUser({ email: 'ortopedi@surgiplan.com', fullName: 'Burak Sezer', role: Role.Surgeon, title: 'Doç. Dr.', branch: 1 }),
    await mkUser({ email: 'kadindogum@surgiplan.com', fullName: 'Deniz Karaca', role: Role.Surgeon, title: 'Op. Dr.', branch: 2 }),
    await mkUser({ email: 'kbb@surgiplan.com', fullName: 'Serkan Uysal', role: Role.Surgeon, title: 'Op. Dr.', branch: 3 }),
    await mkUser({ email: 'uroloji@surgiplan.com', fullName: 'Okan Bilgin', role: Role.Surgeon, title: 'Prof. Dr.', branch: 4 }),
    await mkUser({ email: 'beyin@surgiplan.com', fullName: 'Pınar Ateş', role: Role.Surgeon, title: 'Op. Dr.', branch: 5 }),
  ];

  const assistantBySurgeon = new Map<string, string>([
    [surgeons[0].id, (await mkUser({ email: 'asistan@surgiplan.com', fullName: 'Can Polat', role: Role.Assistant, title: 'Dr.', branch: 0, supervisorId: surgeons[0].id })).id],
    [surgeons[1].id, (await mkUser({ email: 'asistan2@surgiplan.com', fullName: 'İrem Ekinci', role: Role.Assistant, title: 'Dr.', branch: 1, supervisorId: surgeons[1].id })).id],
  ]);

  // Each room keeps its own anesthetist and scrub nurse for the day, so nobody is double-booked.
  const anesthetists = [
    await mkUser({ email: 'anestezi@surgiplan.com', fullName: 'Tolga Korkmaz', role: Role.Anesthetist, title: 'Uzm. Dr.' }),
    await mkUser({ email: 'anestezi2@surgiplan.com', fullName: 'Nazlı Erdem', role: Role.Anesthetist, title: 'Uzm. Dr.' }),
    await mkUser({ email: 'anestezi3@surgiplan.com', fullName: 'Volkan Duman', role: Role.Anesthetist, title: 'Doç. Dr.' }),
    await mkUser({ email: 'anestezi4@surgiplan.com', fullName: 'Gizem Tekin', role: Role.Anesthetist, title: 'Uzm. Dr.' }),
    await mkUser({ email: 'anestezi5@surgiplan.com', fullName: 'Barış Aydın', role: Role.Anesthetist, title: 'Uzm. Dr.' }),
    await mkUser({ email: 'anestezi6@surgiplan.com', fullName: 'Melis Yalçın', role: Role.Anesthetist, title: 'Uzm. Dr.' }),
  ];

  const nurses = [
    await mkUser({ email: 'hemsire@surgiplan.com', fullName: 'Derya Güneş', role: Role.Nurse }),
    await mkUser({ email: 'hemsire2@surgiplan.com', fullName: 'Sibel Avcı', role: Role.Nurse }),
    await mkUser({ email: 'hemsire3@surgiplan.com', fullName: 'Ebru Taş', role: Role.Nurse }),
    await mkUser({ email: 'hemsire4@surgiplan.com', fullName: 'Hande Sarı', role: Role.Nurse }),
    await mkUser({ email: 'hemsire5@surgiplan.com', fullName: 'Özge Kurt', role: Role.Nurse }),
    await mkUser({ email: 'hemsire6@surgiplan.com', fullName: 'Tuba Çınar', role: Role.Nurse }),
  ];

  const patients = [];
  for (let i = 0; i < 120; i++) {
    patients.push(
      await prisma.patient.create({
        data: {
          mrn: String(2200100 + i * 7),
          firstName: pick(firstNames, i * 3),
          lastName: pick(lastNames, i * 7 + 2),
          birthDate: new Date(Date.UTC(1950 + ((i * 13) % 55), (i * 5) % 12, 1 + ((i * 11) % 27))),
          gender: i % 2 === 0 ? 'K' : 'E',
          allergies: i % 11 === 0 ? 'Penisilin' : i % 17 === 0 ? 'Lateks' : null,
        },
      }),
    );
  }

  const today = startOfDay(new Date());
  const leave = { surgeon: surgeons[3], from: addDays(today, 3), to: addDays(today, 5) };
  await prisma.unavailability.create({
    data: {
      userId: leave.surgeon.id,
      startsAt: hospitalTime(leave.from, 0),
      endsAt: hospitalTime(leave.to, 0),
      kind: 'LEAVE',
      note: 'Yıllık izin',
    },
  });

  const now = new Date();
  let patientIndex = 0;
  let caseIndex = 0;

  for (let dayOffset = -21; dayOffset <= 6; dayOffset++) {
    const day = addDays(today, dayOffset);
    const weekday = day.getDay();
    if (weekday === 0) continue;
    const isSaturday = weekday === 6;

    for (const [roomIndex, room] of roomRecords.entries()) {
      if (isSaturday && roomIndex > 1) continue;

      const branchIndex = (roomIndex + dayOffset + 21) % branches.length;
      const surgeon = surgeons[branchIndex];
      if (surgeon.id === leave.surgeon.id && day >= leave.from && day < leave.to) continue;

      const anesthetist = anesthetists[roomIndex];
      const nurse = nurses[roomIndex];
      const assistantId = assistantBySurgeon.get(surgeon.id);
      const branchProcedures = proceduresByBranch[branchIndex];

      let cursor = hospitalTime(day, 8, roomIndex % 3 === 0 ? 0 : 15 * (roomIndex % 3));
      const lastStart = hospitalTime(day, isSaturday ? 12 : LAST_START_HOUR);

      for (let c = 0; cursor < lastStart; c++) {
        const procedure = pick(branchProcedures, c + dayOffset + roomIndex);
        const estimate = procedure.defaultDurationMinutes;
        const plannedStart = cursor;
        const plannedEnd = addMinutes(plannedStart, estimate);
        const roll = caseIndex++ % 23;

        let status: SurgeryStatus = SurgeryStatus.Scheduled;
        let actualStart: Date | null = null;
        let actualEnd: Date | null = null;
        let statusReason: string | null = null;
        let overrun = 0;

        if (plannedEnd < now) {
          if (roll === 4) {
            status = SurgeryStatus.Cancelled;
            statusReason = pick(lostReasons.cancelled, caseIndex);
          } else if (roll === 11) {
            status = SurgeryStatus.Postponed;
            statusReason = pick(lostReasons.postponed, caseIndex);
          } else {
            status = SurgeryStatus.Completed;
            const drift = ((roll * 11) % 35) - 10;
            actualStart = addMinutes(plannedStart, c === 0 ? (roll % 5) * 4 : (roll % 3) * 5);
            actualEnd = addMinutes(actualStart, Math.max(20, estimate + drift));
            overrun = Math.max(0, actualEnd.getTime() - plannedEnd.getTime()) / 60_000;
            if (actualEnd > now) {
              status = SurgeryStatus.InProgress;
              actualEnd = null;
            }
          }
        } else if (plannedStart < now) {
          status = SurgeryStatus.InProgress;
          actualStart = new Date(Math.min(addMinutes(plannedStart, 5).getTime(), now.getTime()));
        } else if (dayOffset === 0 && plannedStart.getTime() - now.getTime() < 45 * 60_000) {
          status = SurgeryStatus.Preparing;
        }

        const done = status === SurgeryStatus.Completed;
        const started = done || status === SurgeryStatus.InProgress;

        await prisma.surgery.create({
          data: {
            patientId: patients[patientIndex++ % patients.length].id,
            procedureId: procedure.id,
            roomId: room.id,
            surgeonId: surgeon.id,
            anesthetistId: anesthetist.id,
            createdById: coordinator.id,
            status,
            statusReason,
            priority: roll === 7 ? 'URGENT' : 'ELECTIVE',
            anesthesiaType: procedure.code === 'KD-001' || procedure.code === 'UR-001' ? 'SPINAL' : 'GENERAL',
            estimatedMinutes: estimate,
            requestedDate: day,
            plannedStart,
            plannedEnd,
            actualStart,
            actualEnd,
            team: {
              create: [{ userId: nurse.id, role: 'SCRUB_NURSE' }, ...(assistantId ? [{ userId: assistantId, role: 'ASSISTANT' }] : [])],
            },
            equipment: {
              create: (procedureEquipment[procedure.code] ?? []).map((code) => ({ equipmentId: equipmentByCode.get(code)! })),
            },
            checklist: {
              create: checklistTemplate.map((item) => {
                const checked = done || (started && item.phase !== 'SIGN_OUT');
                return {
                  key: item.key,
                  checked,
                  checkedById: checked ? (item.phase === 'SIGN_IN' ? anesthetist.id : nurse.id) : null,
                  checkedAt: checked ? actualStart : null,
                };
              }),
            },
            events: {
              create: [
                { actorId: coordinator.id, type: 'SCHEDULED', toStatus: SurgeryStatus.Scheduled, note: `${room.code}`, createdAt: addDays(plannedStart, -2) },
                ...(status !== SurgeryStatus.Scheduled
                  ? [{ actorId: started ? nurse.id : surgeon.id, type: 'STATUS', fromStatus: SurgeryStatus.Scheduled, toStatus: status, note: statusReason, createdAt: actualEnd ?? actualStart ?? plannedStart }]
                  : []),
              ],
            },
          },
        });

        cursor = addMinutes(plannedEnd, overrun + room.turnoverMinutes + (c % 2 === 0 ? 0 : 15));
      }
    }
  }

  const pendingRequests = [
    { branch: 0, code: 'GC-001', days: 1, note: 'Tekrarlayan kolesistit atakları' },
    { branch: 1, code: 'OR-001', days: 2, note: 'Sağ diz gonartroz, konservatif tedaviye yanıtsız' },
    { branch: 4, code: 'UR-001', days: 2, note: 'Benign prostat hiperplazisi' },
    { branch: 5, code: 'BC-001', days: 3, note: 'L4-L5 disk hernisi' },
    { branch: 2, code: 'KD-002', days: 4, note: 'Myoma uteri' },
  ];

  for (const req of pendingRequests) {
    const procedure = proceduresByBranch[req.branch].find((p) => p.code === req.code)!;
    const surgeon = surgeons[req.branch];
    await prisma.surgery.create({
      data: {
        patientId: patients[patientIndex++ % patients.length].id,
        procedureId: procedure.id,
        surgeonId: surgeon.id,
        createdById: surgeon.id,
        status: SurgeryStatus.PendingApproval,
        estimatedMinutes: procedure.defaultDurationMinutes,
        requestedDate: addDays(today, req.days),
        anesthesiaType: 'GENERAL',
        diagnosis: req.note,
        team: assistantBySurgeon.has(surgeon.id) ? { create: [{ userId: assistantBySurgeon.get(surgeon.id)!, role: 'ASSISTANT' }] } : undefined,
        equipment: { create: (procedureEquipment[procedure.code] ?? []).map((code) => ({ equipmentId: equipmentByCode.get(code)! })) },
        checklist: { create: checklistTemplate.map((item) => ({ key: item.key })) },
        events: { create: [{ actorId: surgeon.id, type: 'CREATED', toStatus: SurgeryStatus.PendingApproval }] },
      },
    });
  }

  console.log(`Seed complete. Demo password for all users: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
