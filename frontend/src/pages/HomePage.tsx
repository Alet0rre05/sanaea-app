import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useSession } from '../context/SessionContext';
import { TariffSimulator } from '../components/billing/TariffSimulator';

const BILLING_ROLES = ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_LIQUIDATOR'];

export function HomePage() {
  const { t } = useTranslation();
  const { activeMembership } = useSession();

  const { data: pending } = useQuery({
    queryKey: ['legal', 'pending'],
    queryFn: async () => (await api.get<unknown[]>('/legal/pending/')).data,
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">{activeMembership?.tenant_name ?? ''}</p>
        <h1 className="font-display text-3xl font-extrabold">{t('nav.dashboard')}</h1>
      </header>

      {pending && pending.length > 0 && (
        <div role="alert" className="card border-warning/50 text-sm">
          {t('legal.pending')}
        </div>
      )}

      {activeMembership && BILLING_ROLES.includes(activeMembership.role) && <TariffSimulator />}
    </div>
  );
}
