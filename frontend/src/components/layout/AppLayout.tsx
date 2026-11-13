import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, EyeOff, FileText, Home, LogOut, Receipt, MessageCircle, ShieldCheck, Leaf } from 'lucide-react';
import { Switch } from '@headlessui/react';
import { ThemeToggleButton } from '../../theme/ThemeToggleButton';
import { usePreferences } from '../../context/PreferencesContext';
import { useSession } from '../../context/SessionContext';
import { Footer } from './Footer';
import { SupportWidget } from '../support/SupportWidget';

const NAV = [
  { to: '/', key: 'nav.dashboard', icon: Home, end: true },
  { to: '/scans', key: 'nav.scans', icon: FileText, end: false },
  { to: '/settlements', key: 'nav.settlements', icon: Receipt, end: false },
  { to: '/chat', key: 'nav.chat', icon: MessageCircle, end: false },
  { to: '/legal', key: 'nav.legal', icon: ShieldCheck, end: false },
];

function useIsMobile(): boolean {
  const query = '(max-width: 767px)';
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMobile(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

/** Barra superior común: selector de agencia, vista simple/detallada y privacidad. */
function Topbar({ onToggleSidebar, showSidebarToggle }: { onToggleSidebar?: () => void; showSidebarToggle: boolean }) {
  const { t } = useTranslation();
  const { viewMode, setViewMode, blurPrivate, setBlurPrivate } = usePreferences();
  const { user, activeMembership, selectTenant, logout } = useSession();
  const navigate = useNavigate();

  return (
    <header className="topbar sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-line/80 bg-canvas/80 px-4 py-3 backdrop-blur-xl">
      {showSidebarToggle && (
        <button type="button" onClick={onToggleSidebar} aria-label="Colapsar menú"
          className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div className="brand-lockup"><span className="brand-mark"><Leaf size={18} /></span><span className="font-display text-lg font-extrabold tracking-tight">{t('app.name')}</span><span className="brand-caption">CUIDADO CONECTADO</span></div>

      {user && user.memberships.length > 1 && (
        <select aria-label="Agencia activa" className="input max-w-[14rem] py-1.5"
          value={activeMembership?.tenant_id ?? ''} onChange={(e) => selectTenant(e.target.value)}>
          {user.memberships.map((m) => (
            <option key={m.tenant_id} value={m.tenant_id}>{m.tenant_name}</option>
          ))}
        </select>
      )}

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
          <span className={viewMode === 'simple' ? 'font-semibold' : 'text-muted'}>{t('view.simple')}</span>
          <Switch checked={viewMode === 'detailed'}
            onChange={(on: boolean) => setViewMode(on ? 'detailed' : 'simple')}
            className="relative inline-flex h-5 w-9 items-center rounded-full bg-line transition data-[checked]:bg-primary"
            aria-label={t('view.detailed')}>
            <span className="inline-block h-4 w-4 translate-x-0.5 rounded-full bg-white transition data-[checked]:translate-x-[18px]" />
          </Switch>
          <span className={viewMode === 'detailed' ? 'font-semibold' : 'text-muted'}>{t('view.detailed')}</span>
        </div>

        <button type="button" onClick={() => setBlurPrivate(!blurPrivate)} aria-pressed={blurPrivate}
          title={t('privacy.hint')}
          className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface">
          <EyeOff className="h-4 w-4" />
          <span className="sr-only">{t('privacy.blur')}</span>
        </button>

        <ThemeToggleButton />

        <button type="button" aria-label={t('nav.logout')}
          onClick={async () => { await logout(); navigate('/login'); }}
          className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function DesktopLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className={`sticky top-0 flex h-screen flex-col gap-1 border-r border-line/80 bg-surface/70 p-3 backdrop-blur-md transition-all ${collapsed ? 'w-16' : 'w-60'}`}>
        <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label="Colapsar menú"
          className="mb-2 self-end rounded-lg p-1.5 text-muted hover:bg-canvas">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        {NAV.map(({ to, key, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-primary/15 font-semibold text-primary' : 'text-ink hover:bg-canvas'}`}>
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{t(key)}</span>}
          </NavLink>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar showSidebarToggle={false} />
        <main className="main-content mx-auto w-full max-w-[1440px] flex-1 p-5 sm:p-7 xl:p-9">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

function MobileLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col pb-20">
      <Topbar showSidebarToggle={false} />
      <main className="flex-1 p-4">{children}</main>
      <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line/80 bg-surface/95 backdrop-blur-md">
        {NAV.map(({ to, key, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-xs ${isActive ? 'font-semibold text-primary' : 'text-muted'}`}>
            <Icon className="h-5 w-5" />
            {t(key)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Layout adaptativo: sidebar en escritorio, barra inferior en móvil. */
export function AppLayout() {
  const mobile = useIsMobile();
  const { user } = useSession();
  return (
    <>
      {mobile ? (
        <MobileLayout><Outlet /></MobileLayout>
      ) : (
        <DesktopLayout><Outlet /></DesktopLayout>
      )}
      {user && <SupportWidget />}
    </>
  );
}
