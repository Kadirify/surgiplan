import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import type { Conflict } from '@surgiplan/shared';

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  listeners.forEach((l) => l(token));
}

export function onTokenChange(listener: (token: string | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export function refreshSession(): Promise<string | null> {
  // Several requests can fail with 401 at once; they all wait on a single refresh call.
  refreshing ??= axios
    .post<{ accessToken: string }>('/api/auth/refresh', null, { withCredentials: true })
    .then((res) => {
      setAccessToken(res.data.accessToken);
      return res.data.accessToken;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthCall = original?.url?.startsWith('/auth/');
  if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
    original._retried = true;
    const token = await refreshSession();
    if (token) return api(original);
  }
  return Promise.reject(error);
});

export interface ProblemDetails {
  status: number;
  title: string;
  detail?: string;
  errors?: string[];
  conflicts?: Conflict[];
  code?: string;
}

export function problemOf(error: unknown): ProblemDetails {
  if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object') {
    return error.response.data as ProblemDetails;
  }
  return { status: 0, title: 'Network error', detail: 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.' };
}

export function errorMessage(error: unknown): string {
  const p = problemOf(error);
  if (p.errors?.length) return p.errors[0];
  return p.detail ?? p.title ?? 'Beklenmeyen bir hata oluştu.';
}
