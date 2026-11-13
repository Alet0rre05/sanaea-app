import { useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NotebookPen } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useSession } from '../context/SessionContext';
import { Adaptive } from '../components/ui/Adaptive';

interface Evolution { id: string; visit: string; text: string; recorded_at: string; }
interface Visit { id: string; patient: string; scheduled_start: string; status: string; }

/** Evoluciones diarias. El prestador registra sobre visitas completadas; el auditor las lee todas. */
export function EvolutionsPage() {
  const { activeMembership } = useSession();
  const isProvider = activeMembership?.role === 'TENANT_PROVIDER';
  const queryClient = useQueryClient();

  const { data: evolutions, isLoading } = useQuery({
    queryKey: ['evolutions'],
    queryFn: async () => (await api.get<Evolution[]>('evolutions/')).data,
  });
  const { data: visits } = useQuery({
    queryKey: ['visits'],
    queryFn: async () => (await api.get<Visit[]>('visits/')).data,
    enabled: isProvider,
  });

  const completed = (visits ?? []).filter((v) => v.status === 'COMPLETED');
  const [visitId, setVisitId] = useState('');
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post('evolutions/', { visit: visitId || completed[0]?.id, text }),
    onSuccess: () => {
      setText('');
      setNotice('Evolución guardada.');
      queryClient.invalidateQueries({ queryKey: ['evolutions'] });
    },
  });

  return (
    <div className="bento">
      {isProvider && (
        <section className="card bento-in col-span-12 xl:col-span-5 space-y-4" style={{ '--i': 0 } as CSSProperties}>
          <div className="flex items-center gap-3">
            <span className="feature-icon feature-icon--mint"><NotebookPen size={19} /></span>
            <div>
              <p className="eyebrow">Nueva evolución</p>
              <h1 className="font-display text-lg font-bold tracking-tight">Registrar la visita</h1>
            </div>
          </div>
          <Adaptive as="p" className="text-xs leading-5 text-muted" simple="Solo visitas completadas." detailed="Podés registrar evoluciones sobre visitas ya completadas. Cada registro queda con fecha y no se edita después." />
          {completed.length === 0 ? (
            <p className="text-sm text-muted">No hay visitas completadas para registrar.</p>
          ) : (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                Visita
                <select className="input" value={visitId || completed[0].id} onChange={(e) => setVisitId(e.target.value)}>
                  {completed.map((v) => <option key={v.id} value={v.id}>{new Date(v.scheduled_start).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted">
                Evolución
                <textarea className="input min-h-[140px]" value={text} onChange={(e) => setText(e.target.value)} required maxLength={5000} />
              </label>
              <button className="btn-primary" type="submit" disabled={!text.trim() || create.isPending}>Guardar evolución</button>
              {notice && !create.isError && <p role="status" className="text-sm font-semibold text-success">{notice}</p>}
              {create.isError && <p role="alert" className="text-sm font-semibold text-danger">{errorMessage(create.error)}</p>}
            </form>
          )}
        </section>
      )}

      <section className={`card bento-in space-y-3 col-span-12 ${isProvider ? 'xl:col-span-7' : ''}`} style={{ '--i': 1 } as CSSProperties}>
        <p className="eyebrow">Historial</p>
        {isLoading && <p className="text-sm text-muted">Cargando…</p>}
        {!isLoading && (evolutions ?? []).length === 0 && <p className="text-sm text-muted">Sin evoluciones registradas.</p>}
        <ul className="space-y-2">
          {(evolutions ?? []).map((ev) => (
            <li key={ev.id} className="rounded-xl border border-line/70 bg-canvas/40 p-3">
              <p className="text-[11px] font-semibold text-muted">{new Date(ev.recorded_at).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6">{ev.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
