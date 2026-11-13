import { useState, type CSSProperties } from 'react';
import { BookOpen, CheckCircle2, Circle } from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { TutorialPlayer } from '../components/tutorials/TutorialPlayer';
import { Adaptive } from '../components/ui/Adaptive';
import { ROLE_LABEL, tutorialsFor, type RoleCode, type Tutorial } from '../content/tutorials';

const DONE_KEY = 'sanae.tutorials.done.v1';

function readDone(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DONE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Tutoriales por rol. El superadmin de plataforma ve el catálogo completo. */
export function TutorialsPage() {
  const { user, activeMembership } = useSession();
  const role = activeMembership?.role;
  const platformRole = user?.platform_role;
  const visible = tutorialsFor(role, platformRole);
  const [selectedId, setSelectedId] = useState<string>(visible[0]?.id ?? '');
  const selected: Tutorial | undefined = visible.find((t) => t.id === selectedId) ?? visible[0];
  const done = readDone();
  const isSuper = platformRole === 'PLATFORM_SUPERADMIN';
  const roleName = role ? ROLE_LABEL[role as RoleCode] : 'Sin rol activo';

  return (
    <div className="bento">
      <section className="welcome-panel bento-in col-span-12 xl:col-span-7" style={{ '--i': 0 } as CSSProperties}>
        <div className="welcome-glow welcome-glow--one" />
        <div className="relative z-10 max-w-xl">
          <p className="eyebrow eyebrow--light"><BookOpen size={13} /> Aprender en Sanae</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">Tutoriales</h1>
          <Adaptive as="p" className="mt-3 text-sm leading-6 text-white/75" simple="Recorridos de 3 a 5 pasos." detailed="Cada tutorial muestra una tarea completa, paso a paso, con el enlace a la sección donde se hace." />
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="welcome-chip">{roleName}</span>
            {isSuper
              ? <span className="welcome-chip">Viendo todos los tutoriales</span>
              : <span className="welcome-chip">{visible.length} para tu rol</span>}
          </div>
        </div>
      </section>

      <div className="col-span-12 xl:col-span-7">
        {selected && <TutorialPlayer key={selected.id} tutorial={selected} />}
      </div>

      <section className="col-span-12 xl:col-span-5 space-y-3" aria-label="Lista de tutoriales">
        {visible.map((tutorial, index) => {
          const isDone = done.includes(tutorial.id);
          const isSelected = tutorial.id === selected?.id;
          return (
            <button
              type="button"
              key={tutorial.id}
              onClick={() => setSelectedId(tutorial.id)}
              aria-pressed={isSelected}
              style={{ '--i': index + 1 } as CSSProperties}
              className={`card bento-in flex w-full items-start gap-3 text-left transition hover:border-primary/40 ${index % 3 === 1 ? 'xl:ml-6' : ''} ${isSelected ? 'border-primary/50 bg-primary/5' : ''}`}
            >
              <span className={`feature-icon feature-icon--${tutorial.tone} shrink-0`}><BookOpen size={19} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold">
                  {tutorial.title}
                  {isDone ? <CheckCircle2 size={14} className="text-success" aria-label="Completado" /> : <Circle size={12} className="text-muted" aria-hidden="true" />}
                </span>
                <Adaptive as="span" className="mt-0.5 block text-xs leading-5 text-muted" simple={tutorial.summary.simple} detailed={tutorial.summary.detailed} />
                <span className="mt-2 block text-[11px] font-semibold text-muted">{tutorial.steps.length} pasos</span>
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
