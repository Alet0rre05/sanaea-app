import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../context/SessionContext';
import { api } from '../../lib/api';

/** Exige sesión y, si hay documentos legales pendientes, redirige a /legal. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const location = useLocation();
  const { data: pending, isLoading } = useQuery({
    queryKey: ['legal', 'pending'],
    queryFn: async () => (await api.get<unknown[]>('/legal/pending/')).data,
    enabled: Boolean(user),
  });

  if (loading) return <p className="p-6 text-sm text-muted">…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (isLoading) return <p className="p-6 text-sm text-muted">…</p>;
  if (pending && pending.length > 0 && location.pathname !== '/legal') {
    return <Navigate to="/legal" replace />;
  }
  return <>{children}</>;
}
