import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../../lib/api';
import { Sensitive } from '../ui/Sensitive';

interface SimulationResult {
  amount: string;
  breakdown: Record<string, string | number>;
}

/** Simulador de tarifa en tiempo real (recalcula con 400 ms de debounce). */
export function TariffSimulator() {
  const { t } = useTranslation();
  const [tariffId, setTariffId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [holiday, setHoliday] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tariffId || !start || !end) {
      setResult(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.post<SimulationResult>('/simulator/', {
          tariff_id: tariffId,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          is_holiday: holiday,
        });
        setResult(data);
        setError(null);
      } catch (err) {
        setResult(null);
        setError(errorMessage(err, t('common.error')));
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [tariffId, start, end, holiday, t]);

  return (
    <section className="card space-y-3" aria-label={t('simulator.title')}>
      <h2 className="font-display text-lg font-bold">{t('simulator.title')}</h2>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">{t('simulator.tariff')}</span>
        <input className="input kpi-number" value={tariffId} onChange={(e) => setTariffId(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">{t('simulator.start')}</span>
          <input type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">{t('simulator.end')}</span>
          <input type="datetime-local" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={holiday} onChange={(e) => setHoliday(e.target.checked)} />
        {t('simulator.holiday')}
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {result && (
        <div className="rounded-xl bg-canvas p-3">
          <p className="text-sm text-muted">{t('simulator.amount')}</p>
          <Sensitive>
            <p className="kpi-number text-2xl font-extrabold">${result.amount}</p>
          </Sensitive>
          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer">{t('view.detailed')}</summary>
            <pre className="kpi-number mt-2 overflow-auto">{JSON.stringify(result.breakdown, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
