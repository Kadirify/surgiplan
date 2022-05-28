import type {
  AnesthesiaType,
  Laterality,
  Permission,
  Priority,
  Role,
  RoomLiveState,
  SurgeryStatus,
  TeamRole,
  Transition,
  ChecklistPhase,
} from '@surgiplan/shared';

export interface Me {
  id: string;
  email: string;
  fullName: string;
  title: string | null;
  phone: string | null;
  role: Role;
  branch: { id: string; name: string } | null;
  supervisor: { id: string; fullName: string; title: string | null } | null;
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  permissions: Permission[];
}

export interface PersonRef {
  id: string;
  fullName: string;
  title: string | null;
}

export interface UserLookup extends PersonRef {
  role: Role;
  branchId: string | null;
  supervisorId: string | null;
}

export type UserStatus = 'ACTIVE' | 'INVITED' | 'LOCKED' | 'INACTIVE';

export interface UserRow extends PersonRef {
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  branch: { id: string; name: string } | null;
  supervisor: PersonRef | null;
  status: UserStatus;
}

export interface Branch {
  id: string;
  name: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  floor: string | null;
  turnoverMinutes: number;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  quantity: number;
  isActive: boolean;
}

export interface Procedure {
  id: string;
  code: string;
  name: string;
  branchId: string;
  defaultDurationMinutes: number;
  branch?: Branch;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: 'K' | 'E';
  phone?: string | null;
  allergies?: string | null;
}

export interface Surgery {
  id: string;
  number: number;
  status: SurgeryStatus;
  priority: Priority;
  anesthesiaType: AnesthesiaType | null;
  laterality: Laterality;
  estimatedMinutes: number;
  requestedDate: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  diagnosis: string | null;
  notes: string | null;
  statusReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  patient: Patient;
  procedure: { id: string; code: string; name: string };
  room: { id: string; code: string; name: string } | null;
  surgeon: PersonRef;
  anesthetist: PersonRef | null;
  team: Array<{ userId: string; role: TeamRole; fullName: string; title: string | null }>;
  equipment: Array<{ id: string; name: string }>;
}

export interface ChecklistEntry {
  id: string;
  key: string;
  phase: ChecklistPhase;
  text: string;
  checked: boolean;
  checkedAt: string | null;
  checkedBy: { id: string; fullName: string } | null;
}

export interface SurgeryEvent {
  id: string;
  type: string;
  fromStatus: SurgeryStatus | null;
  toStatus: SurgeryStatus | null;
  note: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; role: Role };
}

export interface SurgeryDetail extends Surgery {
  patient: Patient;
  procedure: Surgery['procedure'] & { branch: Branch };
  createdBy: { id: string; fullName: string };
  checklist: ChecklistEntry[];
  events: SurgeryEvent[];
  allowedTransitions: Transition[];
  canEdit: boolean;
  canSchedule: boolean;
}

export interface Estimate {
  minutes: number;
  basis: 'SURGEON' | 'PROCEDURE' | 'CATALOG';
  sampleSize: number;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface BoardCase {
  id: string;
  procedure: string;
  surgeon: string;
  patientInitials: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  estimatedMinutes: number;
  status: SurgeryStatus;
}

export interface BoardRoom {
  id: string;
  code: string;
  name: string;
  state: RoomLiveState;
  cleaningUntil: string | null;
  current?: BoardCase;
  next?: BoardCase;
  completedCount: number;
  totalCount: number;
}

export interface Unavailability {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  kind: 'LEAVE' | 'DUTY' | 'CONGRESS' | 'OTHER';
  note: string | null;
  user: PersonRef & { role: Role };
}

export interface ReportOverview {
  range: { from: string; to: string; workingDays: number };
  summary: {
    total: number;
    completed: number;
    cancelled: number;
    postponed: number;
    utilizationRate: number;
    firstCaseOnTimeRate: number | null;
  };
  utilization: Array<{ roomId: string; code: string; name: string; usedMinutes: number; availableMinutes: number; rate: number }>;
  lostCases: Array<{ reason: string; cancelled: number; postponed: number }>;
  durationAccuracy: Array<{ procedure: string; count: number; avgEstimated: number; avgActual: number; avgDelta: number }>;
  daily: Array<{ date: string; completed: number; cancelled: number; postponed: number }>;
}

export interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  changes: unknown;
  ip: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; role: Role } | null;
}
