import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, BookOpen, CheckCircle2, ClipboardList, FileCheck2, FileSignature, MessageCircle, NotebookPen, ShieldCheck, Sparkles, UserRound, WalletCards } from 'lucide-react';
import { api } from '../lib/api';
import { usePreferences } from '../context/PreferencesContext';
import { useSession } from '../context/SessionContext';
import { TariffSimulator } from '../components/billing/TariffSimulator';
import { Adaptive, DetailOnly } from '../components/ui/Adaptive';
import { StatusBars, type Bar } from '../components/charts/StatusBars';

const BILLING_ROLES = ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_LIQUIDATOR'];

const shortcuts = [
  { to: '/scans', title: 'Planillas y OCR', short: 'Cargar y validar', long: 'Subí fotos de planillas y validá los datos extraídos.', icon: ClipboardList, tone: 'mint' },
  { to: '/settlements', title: 'Liquidaciones', short: 'Borradores', long: 'Revisá los borradores de liquidación y sus validaciones.', icon: WalletCards, tone: 'blue' },
  { to: '/chat', title: 'Conversaciones', short: 'Coordinación', long: 'Canales de coordinación logística por visita y hilos internos.', icon: MessageCircle, tone: 'violet' },
  { to: '/legal', title: 'Documentación legal', short: 'Documentos', long: 'Consultá los documentos legales vigentes y su historial de aceptación.', icon: ShieldCheck, tone: 'amber' },
] as const;

/** Entrada escalonada única al cargar: cada tarjeta recibe un índice. */
const stagger = (index: number) => ({ '--i': index } as CSSProperties);

export function HomePage() {
  const { t } = useTranslation();
  const { activeMembership, user } = useSession();
  const { viewMode } = usePreferences();
  const { data: pending } = useQuery({
    queryKey: ['legal', 'pending'],
    queryFn: async () => (await api.get<unknown[]>('/legal/pending/')).data,
  });

  const role = activeMembership?.role ?? '';
  const roleShortcuts = [
    { to: '/tutoriales', title: 'Tutoriales', short: 'Recorridos de 3 a 5 pasos', long: 'Tutoriales para tu rol, con el enlace a cada sección. Incluye preguntas frecuentes.', icon: BookOpen, tone: 'amber', show: true },
    { to: '/cuenta', title: 'Mi cuenta', short: 'Datos y seguridad', long: 'Cambiá tu email, respaldo o usuario con verificación por código.', icon: UserRound, tone: 'neutral', show: true },
    { to: '/vinculos', title: 'Vínculo familiar', short: 'Verificar vínculo', long: 'Verificá tu vínculo con el paciente para acceder a sus visitas.', icon: BadgeCheck, tone: 'blue', show: role === 'TENANT_FAMILY_CLIENT' },
    { to: '/consentimiento', title: 'Firmar consentimiento', short: 'Firma en pantalla', long: 'Firmá el documento vigente. La firma queda registrada de forma inmutable.', icon: FileSignature, tone: 'violet', show: role === 'TENANT_FAMILY_CLIENT' },
    { to: '/evoluciones', title: 'Evoluciones', short: 'Notas de visita', long: 'Registrá o consultá las evoluciones diarias de cada visita.', icon: NotebookPen, tone: 'mint', show: role === 'TENANT_PROVIDER' || role === 'TENANT_MEDICAL_AUDITOR' },
  ].filter((item) => item.show);

  const pendingCount = pending?.length;
  const hasPending = (pendingCount ?? 0) > 0;

  const isFamily = role === 'TENANT_FAMILY_CLIENT';
  const { data: visits } = useQuery({
    queryKey: ['visits'],
    queryFn: async () => (await api.get<{ status: string }[]>('visits/')).data,
    enabled: role !== '' && !isFamily,
  });
  const countStatus = (status: string) => (visits ?? []).filter((v) => v.status === status).length;
  const visitBars: Bar[] = [
    { label: 'Programadas', value: countStatus('SCHEDULED'), color: '#20B88A' },
    { label: 'Completadas', value: countStatus('COMPLETED'), color: '#10B981' },
    { label: 'Faltantes', value: countStatus('MISSED'), color: '#FB7185' },
  ];
  const greeting = user ? 'Qué bueno verte de nuevo.' : 'Bienvenido a tu espacio de trabajo.';

  return (
    <div className="bento" data-mode={viewMode}>
      {/* Hero */}
      <section className="welcome-panel bento-in col-span-12 xl:col-span-7" style={stagger(0)}>
        <div className="welcome-glow welcome-glow--one" /><div className="welcome-glow welcome-glow--two" />
        <div className="relative z-10 max-w-2xl">
          <p className="eyebrow eyebrow--light"><Sparkles size={13} /> Tu espacio de trabajo</p>
          <p className="mt-5 text-sm font-medium text-white/70">{activeMembership?.tenant_name ?? 'Sanae'}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{greeting}</h1>
          <Adaptive
            as="p"
            className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base"
            simple="Tu resumen del día y tus accesos principales."
            detailed="Todo lo que necesitás para organizar, acompañar y gestionar el cuidado, en un solo lugar."
          />
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="welcome-chip"><ShieldCheck size={14} /> Entorno protegido</span>
            <span className="welcome-chip">Gestión simple y clara</span>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="welcome-art-ring" /><div className="welcome-art-ring welcome-art-ring--inner" />
          <div className="welcome-art-core"><span /></div>
          <div className="welcome-art-dot welcome-art-dot--a" /><div className="welcome-art-dot welcome-art-dot--b" /><div className="welcome-art-dot welcome-art-dot--c" />
        </div>
      </section>

      {/* KPI: documentos pendientes */}
      <Link to="/legal" className={`card bento-in bento-kpi col-span-12 sm:col-span-6 xl:col-span-5 ${hasPending ? 'bento-kpi--alert' : ''}`} style={stagger(1)}>
        <div className="flex items-center justify-between gap-3">
          <span className={`feature-icon ${hasPending ? 'feature-icon--amber' : 'feature-icon--mint'}`}><FileCheck2 size={19} /></span>
          <ArrowUpRight size={16} className="text-muted" />
        </div>
        <p className="kpi-number mt-5 text-4xl font-extrabold tracking-tight" aria-live="polite">{pendingCount ?? '—'}</p>
        <p className="mt-1 text-sm font-semibold">{hasPending ? 'Documentos por aceptar' : 'Documentos al día'}</p>
        <Adaptive as="p" className="mt-1 text-xs leading-5 text-muted" simple={hasPending ? 'Aceptá para seguir.' : 'Sin pendientes.'} detailed={hasPending ? t('legal.pending') : 'La versión vigente de cada documento está aceptada.'} />
      </Link>

      {/* Accesos rápidos */}
      {shortcuts.map(({ to, title, short, long, icon: Icon, tone }, index) => (
        <Link to={to} key={to} className="card bento-in bento-tile group col-span-12 sm:col-span-6 xl:col-span-3" style={stagger(index + 2)}>
          <div className="flex items-start justify-between gap-3">
            <div className={`feature-icon feature-icon--${tone}`}><Icon size={21} /></div>
            <ArrowUpRight size={16} className="text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <h3 className="mt-5 text-sm font-bold">{title}</h3>
          <Adaptive as="p" className="mt-1 text-xs leading-5 text-muted" simple={short} detailed={long} />
        </Link>
      ))}

      {/* Accesos según el rol */}
      {roleShortcuts.map(({ to, title, short, long, icon: Icon, tone }, index) => (
        <Link to={to} key={to} className="card bento-in bento-tile group col-span-12 sm:col-span-6 xl:col-span-3" style={stagger(index + 10)}>
          <div className="flex items-start justify-between gap-3">
            <div className={`feature-icon feature-icon--${tone}`}><Icon size={21} /></div>
            <ArrowUpRight size={16} className="text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <h3 className="mt-5 text-sm font-bold">{title}</h3>
          <Adaptive as="p" className="mt-1 text-xs leading-5 text-muted" simple={short} detailed={long} />
        </Link>
      ))}

      {/* Gráfica de visitas: asimétrica con próximos pasos */}
      {!isFamily && role !== '' && (
        <section className="card bento-in col-span-12 xl:col-span-7 space-y-5" style={stagger(6)}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Visitas</p>
              <h2 className="mt-1 font-display text-lg font-bold tracking-tight">Estado de las visitas</h2>
            </div>
            <span className="kpi-number text-2xl font-extrabold">{visits?.length ?? '—'}<span className="ml-1 text-xs font-semibold text-muted">total</span></span>
          </div>
          <StatusBars bars={visitBars} label="Cantidad de visitas por estado" />
          <Adaptive as="p" className="text-xs leading-5 text-muted" simple="Programadas, completadas y faltantes." detailed="Cuenta las visitas visibles para tu rol según su estado actual. Las faltantes deberían revisarse con el prestador." />
        </section>
      )}

      {/* Próximos pasos */}
      <section className="card bento-in col-span-12 sm:col-span-6 xl:col-span-5" style={stagger(7)}>
        <p className="eyebrow">Próximos pasos</p>
        <h2 className="mt-1 font-display text-lg font-bold tracking-tight">Qué conviene hacer</h2>
        <ul className="mt-4 space-y-2.5">
          <li className="bento-step">
            {hasPending
              ? <><FileCheck2 size={16} className="text-warning" /><span className="text-sm">Aceptar {pendingCount} documento{pendingCount === 1 ? '' : 's'}</span></>
              : <><CheckCircle2 size={16} className="text-success" /><span className="text-sm">Documentos al día</span></>}
          </li>
          <li className="bento-step">
            <ClipboardList size={16} className="text-primary" />
            <span className="text-sm">Revisar planillas cargadas</span>
          </li>
        </ul>
      </section>

      {/* Modo de vista: guía */}
      <section className="card bento-in col-span-12 sm:col-span-6 xl:col-span-4" style={stagger(7)}>
        <div className="flex items-center justify-between gap-2">
          <span className="feature-icon feature-icon--mint"><Sparkles size={19} /></span>
          <span className="status-pill status-pill--green">{viewMode === 'simple' ? 'Vista simple' : 'Vista detallada'}</span>
        </div>
        <h2 className="mt-4 text-sm font-bold">{viewMode === 'simple' ? 'Lo esencial, sin ruido' : 'Contexto completo'}</h2>
        <Adaptive
          as="p"
          className="mt-1 text-xs leading-5 text-muted"
          simple="Textos breves y solo lo principal."
          detailed="Textos ampliados, identificadores y contexto operativo cuando el servidor lo informa. Cambiá el modo desde la barra superior."
        />
      </section>

      {/* Contexto ampliado: solo en Vista detallada */}
      <DetailOnly>
        <section className="card bento-in col-span-12 sm:col-span-6 xl:col-span-4" style={stagger(8)}>
          <p className="eyebrow">Contexto de tu espacio</p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-[11px] font-semibold text-muted">Organización activa</dt><dd className="font-semibold">{activeMembership?.tenant_name ?? 'Sin organización seleccionada'}</dd></div>
            <div><dt className="text-[11px] font-semibold text-muted">Perfil de acceso</dt><dd className="font-semibold">{activeMembership?.role ?? 'No disponible'}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted">Los módulos no muestran registros fuera del alcance de tu cuenta.</p>
        </section>
      </DetailOnly>

      {/* Herramientas de gestión */}
      {activeMembership && BILLING_ROLES.includes(activeMembership.role) && (
        <section className="bento-in col-span-12 space-y-3" style={stagger(9)}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Herramientas de gestión</p>
              <h2 className="font-display text-xl font-bold tracking-tight">Planificación y tarifas</h2>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted"><WalletCards size={14} /> Simulación en tiempo real</span>
          </div>
          <TariffSimulator />
        </section>
      )}

      <div className="dashboard-note col-span-12 bento-in" style={stagger(10)}>
        <span className="dashboard-note-icon"><ShieldCheck size={17} /></span>
        <p>La información que ves depende de tu perfil y de los permisos de tu organización.</p>
      </div>
    </div>
  );
}
