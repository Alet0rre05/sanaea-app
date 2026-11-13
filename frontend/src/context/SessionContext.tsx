import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, session } from '../lib/api';

export interface Membership {
  id: string;
  tenant_id: string;
  tenant_name: string;
  role: string;
  membership_active: boolean;
}

export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  platform_role: string | null;
  memberships: Membership[];
}

interface SessionState {
  user: CurrentUser | null;
  activeMembership: Membership | null;
  loading: boolean;
  setUser: (user: CurrentUser | null) => void;
  selectTenant: (tenantId: string) => void;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

const ACTIVE_TENANT_KEY = 'ajr-active-tenant';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback((next: CurrentUser | null) => {
    setUserState(next);
    if (!next) {
      setActiveTenantId(null);
      session.setTenantId(null);
      return;
    }
    const saved = sessionStorage.getItem(ACTIVE_TENANT_KEY);
    const valid = next.memberships.find((m) => m.tenant_id === saved) ?? next.memberships[0];
    const tenantId = valid?.tenant_id ?? null;
    setActiveTenantId(tenantId);
    session.setTenantId(tenantId);
    if (tenantId) sessionStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  }, []);

  const reloadUser = useCallback(async () => {
    const { data } = await api.get<CurrentUser>('/me/');
    applyUser(data);
  }, [applyUser]);

  // Al abrir la app: intenta recuperar la sesión con la cookie de refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refresh = await api.post<{ access: string }>('/auth/refresh/');
        session.setAccessToken(refresh.data.access);
        await reloadUser();
      } catch {
        applyUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const onExpired = () => applyUser(null);
    window.addEventListener('session-expired', onExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('session-expired', onExpired);
    };
  }, [applyUser, reloadUser]);

  const selectTenant = useCallback((tenantId: string) => {
    setActiveTenantId(tenantId);
    session.setTenantId(tenantId);
    sessionStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout/');
    } finally {
      session.setAccessToken(null);
      applyUser(null);
    }
  }, [applyUser]);

  const activeMembership = useMemo(
    () => user?.memberships.find((m) => m.tenant_id === activeTenantId) ?? null,
    [user, activeTenantId],
  );

  const value = useMemo<SessionState>(
    () => ({ user, activeMembership, loading, setUser: applyUser, selectTenant, logout, reloadUser }),
    [user, activeMembership, loading, applyUser, selectTenant, logout, reloadUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider');
  return ctx;
}
