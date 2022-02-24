import { Role } from './roles';

export const SurgeryStatus = {
  Draft: 'DRAFT',
  PendingApproval: 'PENDING_APPROVAL',
  Scheduled: 'SCHEDULED',
  Preparing: 'PREPARING',
  InProgress: 'IN_PROGRESS',
  Completed: 'COMPLETED',
  Postponed: 'POSTPONED',
  Cancelled: 'CANCELLED',
} as const;
export type SurgeryStatus = typeof SurgeryStatus[keyof typeof SurgeryStatus];

export const surgeryStatusLabels: Record<SurgeryStatus, string> = {
  DRAFT: 'Taslak',
  PENDING_APPROVAL: 'Onay Bekliyor',
  SCHEDULED: 'Planlandı',
  PREPARING: 'Hasta Hazırlanıyor',
  IN_PROGRESS: 'Ameliyatta',
  COMPLETED: 'Tamamlandı',
  POSTPONED: 'Ertelendi',
  CANCELLED: 'İptal Edildi',
};

export const ACTIVE_STATUSES: readonly SurgeryStatus[] = [
  SurgeryStatus.Scheduled,
  SurgeryStatus.Preparing,
  SurgeryStatus.InProgress,
  SurgeryStatus.Completed,
];

export interface Transition {
  to: SurgeryStatus;
  roles: readonly Role[];
  requiresReason?: boolean;
  label: string;
}

const S = SurgeryStatus;
const R = Role;
const ownerRoles = [R.Surgeon, R.Assistant, R.Secretary, R.Coordinator, R.Admin] as const;
const floorRoles = [R.Nurse, R.Anesthetist, R.Coordinator, R.Admin] as const;

// SCHEDULED is only reachable through the schedule endpoint, which runs the conflict check.
export const transitions: Record<SurgeryStatus, readonly Transition[]> = {
  DRAFT: [
    { to: S.PendingApproval, roles: [R.Surgeon, R.Secretary, R.Coordinator, R.Admin], label: 'Onaya Gönder' },
    { to: S.Cancelled, roles: ownerRoles, requiresReason: true, label: 'İptal Et' },
  ],
  PENDING_APPROVAL: [
    { to: S.Draft, roles: [R.Coordinator, R.Admin], requiresReason: true, label: 'Düzeltmeye Gönder' },
    { to: S.Cancelled, roles: ownerRoles, requiresReason: true, label: 'İptal Et' },
  ],
  SCHEDULED: [
    { to: S.Preparing, roles: floorRoles, label: 'Hazırlığa Al' },
    { to: S.Postponed, roles: [R.Surgeon, R.Coordinator, R.Admin], requiresReason: true, label: 'Ertele' },
    { to: S.Cancelled, roles: [R.Surgeon, R.Coordinator, R.Admin], requiresReason: true, label: 'İptal Et' },
  ],
  PREPARING: [
    { to: S.InProgress, roles: floorRoles, label: 'Ameliyatı Başlat' },
    { to: S.Postponed, roles: [R.Surgeon, R.Anesthetist, R.Coordinator, R.Admin], requiresReason: true, label: 'Ertele' },
  ],
  IN_PROGRESS: [{ to: S.Completed, roles: floorRoles, label: 'Ameliyatı Bitir' }],
  COMPLETED: [],
  POSTPONED: [
    { to: S.PendingApproval, roles: [R.Surgeon, R.Coordinator, R.Admin], label: 'Yeniden Onaya Gönder' },
    { to: S.Cancelled, roles: [R.Surgeon, R.Coordinator, R.Admin], requiresReason: true, label: 'İptal Et' },
  ],
  CANCELLED: [],
};

export function findTransition(from: SurgeryStatus, to: SurgeryStatus): Transition | undefined {
  return transitions[from].find((t) => t.to === to);
}

export function allowedTransitions(from: SurgeryStatus, role: Role): Transition[] {
  return transitions[from].filter((t) => t.roles.includes(role));
}

export const Priority = {
  Elective: 'ELECTIVE',
  Urgent: 'URGENT',
  Emergency: 'EMERGENCY',
} as const;
export type Priority = typeof Priority[keyof typeof Priority];

export const priorityLabels: Record<Priority, string> = {
  ELECTIVE: 'Elektif',
  URGENT: 'Öncelikli',
  EMERGENCY: 'Acil',
};

export const AnesthesiaType = {
  General: 'GENERAL',
  Spinal: 'SPINAL',
  Epidural: 'EPIDURAL',
  Regional: 'REGIONAL',
  Local: 'LOCAL',
  Sedation: 'SEDATION',
} as const;
export type AnesthesiaType = typeof AnesthesiaType[keyof typeof AnesthesiaType];

export const anesthesiaLabels: Record<AnesthesiaType, string> = {
  GENERAL: 'Genel',
  SPINAL: 'Spinal',
  EPIDURAL: 'Epidural',
  REGIONAL: 'Rejyonel blok',
  LOCAL: 'Lokal',
  SEDATION: 'Sedasyon',
};

export const Laterality = {
  None: 'NONE',
  Left: 'LEFT',
  Right: 'RIGHT',
  Bilateral: 'BILATERAL',
} as const;
export type Laterality = typeof Laterality[keyof typeof Laterality];

export const lateralityLabels: Record<Laterality, string> = {
  NONE: 'Yok',
  LEFT: 'Sol',
  RIGHT: 'Sağ',
  BILATERAL: 'Bilateral',
};

export const TeamRole = {
  Assistant: 'ASSISTANT',
  ScrubNurse: 'SCRUB_NURSE',
  CirculatingNurse: 'CIRCULATING_NURSE',
} as const;
export type TeamRole = typeof TeamRole[keyof typeof TeamRole];

export const teamRoleLabels: Record<TeamRole, string> = {
  ASSISTANT: 'Asistan',
  SCRUB_NURSE: 'Steril Hemşire',
  CIRCULATING_NURSE: 'Sirküle Hemşire',
};

export type ConflictKind =
  | 'ROOM'
  | 'TURNOVER'
  | 'SURGEON'
  | 'ANESTHETIST'
  | 'TEAM_MEMBER'
  | 'EQUIPMENT'
  | 'UNAVAILABLE'
  | 'OUTSIDE_HOURS';

export interface Conflict {
  kind: ConflictKind;
  message: string;
  surgeryId?: string;
  userId?: string;
  equipmentId?: string;
  blocking: boolean;
}

export type RoomLiveState = 'IDLE' | 'PREPARING' | 'IN_PROGRESS' | 'CLEANING';
