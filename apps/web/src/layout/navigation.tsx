import { Permission, Role } from '@surgiplan/shared';
import type { Me } from '@/api/types';

export interface NavItem {
  label: string;
  to: string;
  visible: (user: Me) => boolean;
  badge?: 'pending';
}

const has = (p: Permission) => (u: Me) => u.permissions.includes(p);
const roles = (...list: Role[]) => (u: Me) => list.includes(u.role);
const always = () => true;

export const mainNav: NavItem[] = [
  { label: 'Günlük Durum', to: '/', visible: always },
  { label: 'Takvim', to: '/schedule', visible: always },
  { label: 'Talepler', to: '/requests', visible: has(Permission.SurgeriesCreate), badge: 'pending' },
  { label: 'Vakalarım', to: '/my', visible: roles(Role.Surgeon, Role.Assistant, Role.Anesthetist, Role.Nurse) },
  { label: 'İzin / Nöbet', to: '/availability', visible: always },
  { label: 'Raporlar', to: '/reports', visible: has(Permission.ReportsRead) },
];

export const adminNav: NavItem[] = [
  { label: 'Kullanıcılar', to: '/admin/users', visible: has(Permission.UsersManage) },
  { label: 'Salon ve Katalog', to: '/admin/catalog', visible: has(Permission.CatalogManage) },
  { label: 'Denetim İzi', to: '/admin/audit', visible: has(Permission.AuditRead) },
];
