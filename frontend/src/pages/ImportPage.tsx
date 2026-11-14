import { useState, type CSSProperties, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, IdCard, ShieldAlert, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { Adaptive } from '../components/ui/Adaptive';

interface ImportError { row: number; message: string; }
interface ImportPreview {
  total: number;
  valid: number;
  errors: ImportError[];
  preview: { row: number; paciente_id: string; prestador_id: string; inicio: string; fin: string }[];
}

const stagger = (index: number) => ({ '--i': index } as CSSProperties);

/** Importación de visitas desde CSV o XLSX. Primero vista previa; se crea solo si no hay errores. */
export function ImportPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportPreview | null>(null);
  const [created, setCreated] = useState<number | null>(null);

  const send = (commit: boolean) => {
    const form = new FormData();
    form.append('file', file as File);
    form.append('commit', commit ? 'true' : 'false');
    return api.post<ImportPreview & { created?: number }>('visits/import/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const preview = useMutation({
    mutationFn: () => send(false),
    onSuccess: ({ data }) => { setReport(data); setCreated(null); },
    onError: () => setReport(null),
  });

  const commit = useMutation({
    mutationFn: () => send(true),
    onSuccess: ({ data }) => {
      setCreated(data.created ?? 0);
      setReport(null);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
  });

  const canCommit = Boolean(report && report.valid > 0 && report.errors.length === 0);
  const errorText = preview.error ?? commit.error;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (file) preview.mutate();
  }

  return (
    <div className="bento">
      <section className="welcome-panel bento-in col-span-12 xl:col-span-6" style={stagger(0)}>
        <div className="welcome-glow welcome-glow--one" />
        <div className="relative z-10 max-w-md">
          <p className="eyebrow eyebrow--light"><FileSpreadsheet size={13} /> Importar visitas</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">Cargá tu agenda</h1>
          <Adaptive as="p" className="mt-3 text-sm leading-6 text-white/75" simple="CSV o Excel, con vista previa." detailed="Subí un archivo .csv o .xlsx. Antes de crear nada, revisás la vista previa y los errores por fila. Si hay un error, no se crea ninguna visita." />
          <a href="/plantilla-visitas.csv" download className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/15">
            <Download size={14} /> Descargar plantilla
          </a>
          <Link to="/fichas" className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/15">
            <IdCard size={14} /> Ver IDs de pacientes y prestadores
          </Link>
        </div>
      </section>

      <section className="card bento-in col-span-12 xl:col-span-6 space-y-4" style={stagger(1)}>
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="grid gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center text-sm font-semibold text-muted transition hover:border-primary cursor-pointer">
            <Upload className="mx-auto h-6 w-6 text-primary" />
            <span>{file ? file.name : 'Elegí un archivo .csv o .xlsx (hasta 5 MB)'}</span>
            <input type="file" accept=".csv,.xlsx" className="sr-only"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); setCreated(null); }} />
          </label>
          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={!file || preview.isPending}>
            {preview.isPending ? 'Revisando…' : 'Revisar archivo'}
          </button>
        </form>

        {errorText && <p role="alert" className="text-sm font-semibold text-danger">{errorMessage(errorText)}</p>}
        {created !== null && <p role="status" className="text-sm font-semibold text-success">Se crearon {created} visitas.</p>}

        {report && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line/70 bg-canvas/40 p-3"><p className="text-[11px] font-semibold text-muted">Filas</p><p className="kpi-number text-xl font-bold">{report.total}</p></div>
              <div className="rounded-xl border border-line/70 bg-canvas/40 p-3"><p className="text-[11px] font-semibold text-muted">Válidas</p><p className="kpi-number text-xl font-bold text-success">{report.valid}</p></div>
              <div className="rounded-xl border border-line/70 bg-canvas/40 p-3"><p className="text-[11px] font-semibold text-muted">Con error</p><p className="kpi-number text-xl font-bold text-danger">{report.errors.length}</p></div>
            </div>

            {report.errors.length > 0 && (
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-danger"><ShieldAlert size={16} /> Corregí estas filas y volvé a revisar</p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                  {report.errors.map((e) => <li key={`${e.row}-${e.message}`}>Fila {e.row}: {e.message}</li>)}
                </ul>
              </div>
            )}

            {report.preview.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted"><tr><th className="py-2 pr-3">Fila</th><th className="py-2 pr-3">Inicio</th><th className="py-2">Fin</th></tr></thead>
                  <tbody>{report.preview.map((r) => (
                    <tr key={r.row} className="border-t border-line/60"><td className="py-2 pr-3">{r.row}</td><td className="py-2 pr-3 tabular-nums">{r.inicio}</td><td className="py-2 tabular-nums">{r.fin}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            <button type="button" className="btn-primary w-full sm:w-auto" disabled={!canCommit || commit.isPending} onClick={() => commit.mutate()}>
              {commit.isPending ? 'Importando…' : `Importar ${report.valid} visitas`}
            </button>
            {!canCommit && report.errors.length > 0 && (
              <p className="text-xs text-muted">Para importar, todas las filas tienen que ser válidas.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
