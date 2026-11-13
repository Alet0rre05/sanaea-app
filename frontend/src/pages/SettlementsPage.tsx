import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../lib/api';
import { Sensitive } from '../components/ui/Sensitive';
import { UndoToast, useUndoableAction } from '../components/ui/UndoToast';

interface SettlementLine { id: string; visit: string; amount: string; breakdown: Record<string, unknown> }
interface Settlement {
  id: string;
  health_insurance: string;
  period_year: number;
  period_month: number;
  status: 'DRAFT' | 'VALIDATED';
  total_amount: string;
  lines: SettlementLine[];
}

export function SettlementsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [insuranceId, setInsuranceId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [error, setError] = useState<string | null>(null);
  const { schedule, undo, visible } = useUndoableAction();

  const { data: settlements = [] } = useQuery({
    queryKey: ['settlements'],
    queryFn: async () => (await api.get<Settlement[]>('/settlements/')).data,
  });

  const generate = useMutation({
    mutationFn: async () =>
      (await api.post<Settlement>('/settlements/generate/', {
        health_insurance_id: insuranceId, year, month,
      })).data,
    onSuccess: () => { setError(null); void queryClient.invalidateQueries({ queryKey: ['settlements'] }); },
    onError: (err) => setError(errorMessage(err, t('common.error'))),
  });

  const validate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/settlements/${id}/validate/`)).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settlements'] }),
    onError: (err) => setError(errorMessage(err, t('common.error'))),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">{t('settlement.title')}</h1>

      <section className="card grid gap-3 sm:grid-cols-4">
        <input className="input kpi-number sm:col-span-2" placeholder="ID de obra social"
          value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)} />
        <input type="number" className="input kpi-number" value={year} min={2000} max={2100}
          onChange={(e) => setYear(Number(e.target.value))} />
        <input type="number" className="input kpi-number" value={month} min={1} max={12}
          onChange={(e) => setMonth(Number(e.target.value))} />
        <button type="button" className="btn-primary sm:col-span-4" disabled={!insuranceId || generate.isPending}
          onClick={() => generate.mutate()}>
          {t('settlement.generate')}
        </button>
      </section>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <ul className="space-y-4">
        {settlements.map((s) => (
          <li key={s.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="kpi-number">{String(s.period_month).padStart(2, '0')}/{s.period_year}</strong>
              <span className={s.status === 'VALIDATED' ? 'badge-ok' : 'badge-pending'}>
                {s.status === 'VALIDATED' ? t('scan.validated') : t('scan.pending')}
              </span>
            </div>
            <Sensitive>
              <p className="kpi-number text-2xl font-extrabold">
                {t('settlement.total')}: ${s.total_amount}
              </p>
            </Sensitive>
            {s.status === 'DRAFT' && (
              <button type="button" className="btn-primary"
                onClick={() => schedule(
                  () => undefined,
                  () => validate.mutateAsync(s.id).then(() => undefined),
                )}>
                {t('settlement.validate')}
              </button>
            )}
          </li>
        ))}
      </ul>

      <UndoToast visible={visible} onUndo={undo} />
    </div>
  );
}
