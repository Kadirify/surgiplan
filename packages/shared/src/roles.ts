export const Role = {
  Admin: 'ADMIN',
  Coordinator: 'COORDINATOR',
  Surgeon: 'SURGEON',
  Assistant: 'ASSISTANT',
  Anesthetist: 'ANESTHETIST',
  Nurse: 'NURSE',
  Secretary: 'SECRETARY',
} as const;
export type Role = typeof Role[keyof typeof Role];

export const ROLES = Object.values(Role);

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Sistem Yöneticisi',
  COORDINATOR: 'Ameliyathane Koordinatörü',
  SURGEON: 'Cerrah',
  ASSISTANT: 'Asistan Doktor',
  ANESTHETIST: 'Anestezi Uzmanı',
  NURSE: 'Sorumlu Hemşire',
  SECRETARY: 'Sekreter',
};

export const Permission = {
  UsersRead: 'users.read',
  UsersManage: 'users.manage',
  CatalogManage: 'catalog.manage',
  SurgeriesReadAll: 'surgeries.read.all',
  SurgeriesCreate: 'surgeries.create',
  SurgeriesSchedule: 'surgeries.schedule',
  ChecklistUpdate: 'checklist.update',
  PatientsWrite: 'patients.write',
  UnavailabilityManageAll: 'unavailability.manage.all',
  ReportsRead: 'reports.read',
  AuditRead: 'audit.read',
} as const;
export type Permission = typeof Permission[keyof typeof Permission];

const P = Permission;

export const rolePermissions: Record<Role, readonly Permission[]> = {
  ADMIN: Object.values(P),
  COORDINATOR: [
    P.UsersRead,
    P.SurgeriesReadAll,
    P.SurgeriesCreate,
    P.SurgeriesSchedule,
    P.PatientsWrite,
    P.UnavailabilityManageAll,
    P.ReportsRead,
  ],
  SURGEON: [P.UsersRead, P.SurgeriesCreate, P.PatientsWrite],
  ASSISTANT: [P.UsersRead, P.SurgeriesCreate, P.PatientsWrite],
  ANESTHETIST: [P.UsersRead, P.SurgeriesReadAll, P.ChecklistUpdate],
  NURSE: [P.UsersRead, P.SurgeriesReadAll, P.ChecklistUpdate],
  SECRETARY: [P.UsersRead, P.SurgeriesReadAll, P.PatientsWrite, P.ReportsRead],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
