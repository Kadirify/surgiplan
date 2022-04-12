import { Prisma } from '@prisma/client';
import { hasPermission, Permission, Role } from '@surgiplan/shared';
import { AuthUser } from '../common/auth-user';

export interface AccessScope {
  user: AuthUser;
  supervisorId: string | null;
}

export function visibilityFilter(scope: AccessScope): Prisma.SurgeryWhereInput | undefined {
  if (hasPermission(scope.user.role, Permission.SurgeriesReadAll)) return undefined;
  return { OR: ownershipConditions(scope) };
}

export function mineFilter(scope: AccessScope): Prisma.SurgeryWhereInput {
  const id = scope.user.id;
  return {
    OR: [{ surgeonId: id }, { anesthetistId: id }, { team: { some: { userId: id } } }],
  };
}

function ownershipConditions(scope: AccessScope): Prisma.SurgeryWhereInput[] {
  const id = scope.user.id;
  const conditions: Prisma.SurgeryWhereInput[] = [
    { surgeonId: id },
    { anesthetistId: id },
    { createdById: id },
    { team: { some: { userId: id } } },
  ];
  if (scope.user.role === Role.Assistant && scope.supervisorId) {
    conditions.push({ surgeonId: scope.supervisorId });
  }
  return conditions;
}

interface SurgeryOwnership {
  surgeonId: string;
  anesthetistId: string | null;
  createdById: string;
  team: { userId: string }[];
}

export function canRead(scope: AccessScope, s: SurgeryOwnership): boolean {
  if (hasPermission(scope.user.role, Permission.SurgeriesReadAll)) return true;
  return isInvolved(scope, s);
}

export function isInvolved(scope: AccessScope, s: SurgeryOwnership): boolean {
  const id = scope.user.id;
  return (
    s.surgeonId === id ||
    s.anesthetistId === id ||
    s.createdById === id ||
    s.team.some((t) => t.userId === id) ||
    (scope.user.role === Role.Assistant && scope.supervisorId === s.surgeonId)
  );
}

/** Surgeons and assistants may only act on their own cases; floor roles act on any case. */
export function canActOn(scope: AccessScope, s: SurgeryOwnership): boolean {
  const role = scope.user.role;
  if (role === Role.Surgeon || role === Role.Assistant) return isInvolved(scope, s);
  return true;
}
