import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Conflict, Role, SurgeryStatus } from '@surgiplan/shared';
import { api } from './client';
import type {
  AppNotification,
  AuditRow,
  BoardRoom,
  Branch,
  Equipment,
  Estimate,
  Patient,
  Procedure,
  ReportOverview,
  Room,
  Surgery,
  SurgeryDetail,
  Unavailability,
  UserLookup,
  UserRow,
} from './types';

const get = <T>(url: string, params?: object) => api.get<T>(url, { params }).then((r) => r.data);

export const keys = {
  surgeries: ['surgeries'] as const,
  surgery: (id: string) => ['surgeries', id] as const,
  notifications: ['notifications'] as const,
  board: ['board'] as const,
};

export interface SurgeryFilters {
  from?: string;
  to?: string;
  roomId?: string;
  surgeonId?: string;
  status?: SurgeryStatus[];
  mine?: boolean;
  q?: string;
}

export function useSurgeries(filters: SurgeryFilters, enabled = true) {
  return useQuery({
    queryKey: [...keys.surgeries, filters],
    queryFn: () => get<Surgery[]>('/surgeries', { ...filters, status: filters.status?.join(',') }),
    enabled,
    keepPreviousData: true,
  });
}

export function useSurgery(id: string | undefined) {
  return useQuery({
    queryKey: keys.surgery(id ?? ''),
    queryFn: () => get<SurgeryDetail>(`/surgeries/${id}`),
    enabled: !!id,
  });
}

export const useRooms = (all = false) =>
  useQuery({ queryKey: ['rooms', all], queryFn: () => get<Room[]>('/rooms', all ? { all: true } : undefined), staleTime: 5 * 60_000 });

export const useEquipment = () =>
  useQuery({ queryKey: ['equipment'], queryFn: () => get<Equipment[]>('/equipment'), staleTime: 5 * 60_000 });

export const useBranches = () =>
  useQuery({ queryKey: ['branches'], queryFn: () => get<Branch[]>('/branches'), staleTime: 30 * 60_000 });

export const useProcedures = (branchId?: string) =>
  useQuery({ queryKey: ['procedures', branchId], queryFn: () => get<Procedure[]>('/procedures', { branchId }), staleTime: 5 * 60_000 });

export const useUserLookup = (role?: Role) =>
  useQuery({ queryKey: ['users', 'lookup', role], queryFn: () => get<UserLookup[]>('/users/lookup', { role }), staleTime: 60_000 });

export const useUsers = (params: { role?: Role; q?: string }) =>
  useQuery({ queryKey: ['users', 'list', params], queryFn: () => get<UserRow[]>('/users', params), keepPreviousData: true });

export const usePatientSearch = (q: string) =>
  useQuery({ queryKey: ['patients', q], queryFn: () => get<Patient[]>('/patients', { q }), enabled: q.trim().length >= 2 });

export const useEstimate = (procedureId?: string, surgeonId?: string) =>
  useQuery({
    queryKey: ['estimate', procedureId, surgeonId],
    queryFn: () => get<Estimate>('/surgeries/estimate', { procedureId, surgeonId }),
    enabled: !!procedureId,
  });

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => get<{ items: AppNotification[]; unreadCount: number }>('/notifications'),
    refetchInterval: 60_000,
  });

export const useBoard = () =>
  useQuery({ queryKey: keys.board, queryFn: () => get<{ generatedAt: string; rooms: BoardRoom[] }>('/board'), refetchInterval: 30_000 });

export const useReport = (from: string, to: string) =>
  useQuery({ queryKey: ['reports', from, to], queryFn: () => get<ReportOverview>('/reports/overview', { from, to }), keepPreviousData: true });

export const useAudit = (params: { entity?: string; page: number; pageSize: number }) =>
  useQuery({
    queryKey: ['audit', params],
    queryFn: () => get<{ total: number; items: AuditRow[] }>('/audit', params),
    keepPreviousData: true,
  });

export const useUnavailability = (params: { from?: string; to?: string; userId?: string }) =>
  useQuery({ queryKey: ['unavailability', params], queryFn: () => get<Unavailability[]>('/unavailability', params) });

export function useInvalidateSurgeries() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries(keys.surgeries);
    qc.invalidateQueries(keys.board);
  };
}

export interface ScheduleInput {
  id: string;
  roomId: string;
  plannedStart: string;
  durationMinutes?: number;
  anesthetistId?: string;
  version: number;
  acknowledgeWarnings?: boolean;
}

export function useScheduleSurgery() {
  const invalidate = useInvalidateSurgeries();
  return useMutation({
    mutationFn: ({ id, ...body }: ScheduleInput) =>
      api.post<{ surgery: Surgery; warnings: Conflict[] }>(`/surgeries/${id}/schedule`, body).then((r) => r.data),
    onSettled: invalidate,
  });
}

export function useTransition() {
  const invalidate = useInvalidateSurgeries();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; to: SurgeryStatus; reason?: string; version: number }) =>
      api.post<Surgery>(`/surgeries/${id}/transition`, body).then((r) => r.data),
    onSettled: invalidate,
  });
}

export async function previewConflicts(body: {
  surgeryId?: string;
  roomId: string;
  plannedStart: string;
  durationMinutes: number;
  surgeonId: string;
  anesthetistId?: string;
  teamIds?: string[];
  equipmentIds?: string[];
}) {
  return api.post<{ conflicts: Conflict[] }>('/surgeries/conflicts', body).then((r) => r.data.conflicts);
}
