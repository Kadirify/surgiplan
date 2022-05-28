import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hasPermission, Permission } from '@surgiplan/shared';
import { api, refreshSession, setAccessToken } from '@/api/client';
import type { Me } from '@/api/types';

interface AuthState {
  user: Me | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  const loadMe = useCallback(async () => {
    const { data } = await api.get<Me>('/auth/me');
    setUser(data);
    return data;
  }, []);

  useEffect(() => {
    refreshSession()
      .then((token) => (token ? loadMe() : null))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ accessToken: string }>('/auth/login', { email, password });
      setAccessToken(data.accessToken);
      return loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      login,
      logout,
      reload: async () => {
        await loadMe();
      },
      can: (permission) => !!user && hasPermission(user.role, permission),
    }),
    [user, ready, login, logout, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useMe(): Me {
  const { user } = useAuth();
  if (!user) throw new Error('useMe called without a signed-in user');
  return user;
}
