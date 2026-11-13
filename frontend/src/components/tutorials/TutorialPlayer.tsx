import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Route as RouteIcon } from 'lucide-react';
import type { Tutorial } from '../../content/tutorials';
import { Adaptive } from '../ui/Adaptive';

const PROGRESS_KEY = 'sanae.tutorials.done.v1';

function loadDone(): string[] {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function saveDone(ids: string[]): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(ids));
  } catch {
    /* sin almacenamiento el progreso dura lo que dure la pantalla */
  }
}

/** Recorrido de 3 a 5 pasos. El texto cambia según la Vista simple o detallada. */
export function TutorialPlayer({ tutorial }: { tutorial: Tutorial }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<string[]>(loadDone);
  const step = tutorial.steps[index];
  const last = index === tutorial.steps.length - 1;
  const finished = done.includes(tutorial.id);

  useEffect(() => setIndex(0), [tutorial.id]);

  function complete() {
    setDone((current) => {
      const next = Array.from(new Set([...current, tutorial.id]));
      saveDone(next);
      return next;
    });
  }

  return (
    <article className="card bento-in space-y-5" aria-labelledby="tutorial-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Tutorial · {tutorial.steps.length} pasos</p>
          <h2 id="tutorial-title" className="mt-1 font-display text-xl font-bold tracking-tight">{tutorial.title}</h2>
          <Adaptive as="p" className="mt-1 text-xs leading-5 text-muted" simple={tutorial.summary.simple} detailed={tutorial.summary.detailed} />
        </div>
        {finished && <span className="status-pill status-pill--green"><CheckCircle2 size={13} /> Completado</span>}
      </header>

      <ol className="flex items-center gap-2" aria-label="Progreso del tutorial">
        {tutorial.steps.map((s, i) => (
          <li key={s.title} className="flex-1">
            <button type="button" onClick={() => setIndex(i)} aria-current={i === index ? 'step' : undefined}
              aria-label={`Paso ${i + 1}: ${s.title}`}
              className={`h-1.5 w-full rounded-full transition-all duration-300 ${i <= index ? 'bg-primary' : 'bg-line'}`} />
          </li>
        ))}
      </ol>

      <div key={index} className="tutorial-step min-h-[150px] rounded-2xl border border-line/70 bg-canvas/50 p-5">
        <p className="text-[11px] font-semibold text-muted">Paso {index + 1} de {tutorial.steps.length}</p>
        <h3 className="mt-1 font-display text-lg font-bold">{step.title}</h3>
        <Adaptive as="p" className="mt-2 text-sm leading-6" simple={step.simple} detailed={step.detailed} />
        {step.to && (
          <Link to={step.to} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <RouteIcon size={14} /> Ir a esta sección
          </Link>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold disabled:opacity-40">
          <ArrowLeft size={15} /> Anterior
        </button>
        {last ? (
          <button type="button" onClick={complete} className="btn-primary">
            <CheckCircle2 size={15} className="mr-1.5" /> {finished ? 'Listo' : 'Terminar'}
          </button>
        ) : (
          <button type="button" onClick={() => setIndex((i) => i + 1)} className="btn-primary">
            Siguiente <ArrowRight size={15} className="ml-1.5" />
          </button>
        )}
      </footer>
    </article>
  );
}
