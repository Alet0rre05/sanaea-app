import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ClipboardList, FileCheck2, MessageCircle, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { api } from '../lib/api';
import { useSession } from '../context/SessionContext';
import { TariffSimulator } from '../components/billing/TariffSimulator';

const BILLING_ROLES = ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_LIQUIDATOR'];
const shortcuts = [
  { to: '/scans', title: 'Planillas y OCR', description: 'Cargá y validá documentación.', icon: ClipboardList, tone: 'mint' },
  { to: '/settlements', title: 'Liquidaciones', description: 'Revisá borradores y validaciones.', icon: WalletCards, tone: 'blue' },
  { to: '/chat', title: 'Conversaciones', description: 'Accedé a los canales de coordinación.', icon: MessageCircle, tone: 'violet' },
  { to: '/legal', title: 'Documentación legal', description: 'Consultá los documentos vigentes.', icon: ShieldCheck, tone: 'amber' },
];

export function HomePage() {
  const { t } = useTranslation();
  const { activeMembership, user } = useSession();
  const { data: pending } = useQuery({
    queryKey: ['legal', 'pending'],
    queryFn: async () => (await api.get<unknown[]>('/legal/pending/')).data,
  });
  const greeting = user ? 'Qué bueno verte de nuevo.' : 'Bienvenido a tu espacio de trabajo.';

  return <div className="page-stack">
    <section className="welcome-panel">
      <div className="welcome-glow welcome-glow--one" /><div className="welcome-glow welcome-glow--two" />
      <div className="relative z-10 max-w-2xl">
        <div className="eyebrow eyebrow--light"><Sparkles size={13} /> TU ESPACIO DE TRABAJO</div>
        <p className="mt-5 text-sm font-medium text-white/70">{activeMembership?.tenant_name ?? 'SANAE'}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{greeting}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">Todo lo que necesitás para organizar, acompañar y gestionar el cuidado, en un solo lugar.</p>
        <div className="mt-6 flex flex-wrap gap-2"><span className="welcome-chip"><ShieldCheck size={14} /> Entorno protegido</span><span className="welcome-chip">Gestión simple y clara</span></div>
      </div>
      <div className="welcome-art" aria-hidden="true"><div className="welcome-art-ring welcome-art-ring--outer" /><div className="welcome-art-ring welcome-art-ring--inner" /><div className="welcome-art-core"><span /></div><div className="welcome-art-dot welcome-art-dot--a" /><div className="welcome-art-dot welcome-art-dot--b" /><div className="welcome-art-dot welcome-art-dot--c" /></div>
    </section>
    {pending && pending.length > 0 && <Link to="/legal" role="alert" className="legal-alert">
      <span className="legal-alert-icon"><FileCheck2 size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">Tenés documentos pendientes</strong><span className="mt-0.5 block text-xs opacity-75">{t('legal.pending')}</span></span><ArrowUpRight size={18} />
    </Link>}
    <section><div className="section-heading"><div><p className="eyebrow">ACCESOS RÁPIDOS</p><h2 className="font-display text-xl font-bold tracking-tight">¿Qué necesitás hacer?</h2></div><span className="text-xs text-muted">Tus herramientas principales</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shortcuts.map(({ to, title, description, icon: Icon, tone }) => <Link to={to} className="card shortcut-card group" key={to}>
        <div className={`feature-icon feature-icon--${tone}`}><Icon size={21} /></div><div className="mt-5 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{title}</h3><ArrowUpRight size={16} className="text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></div><p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      </Link>)}</div>
    </section>
    {activeMembership && BILLING_ROLES.includes(activeMembership.role) && <section className="dashboard-lower"><div className="section-heading"><div><p className="eyebrow">HERRAMIENTAS DE GESTIÓN</p><h2 className="font-display text-xl font-bold tracking-tight">Planificación y tarifas</h2></div></div><TariffSimulator /></section>}
    <div className="dashboard-note"><span className="dashboard-note-icon"><ShieldCheck size={17} /></span><p>La información que ves depende de tu perfil y de los permisos de tu organización.</p></div>
  </div>;
}
