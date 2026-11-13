import { useCallback, useMemo, useState } from 'react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, FileCheck2, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import { Adaptive } from '../ui/Adaptive';

const READ_KEY = 'sanae.notifications.read.v1';

interface PendingDocument {
  id?: string;
  title?: string;
  kind?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  to: string;
}

/** Lectura persistida por dispositivo. Si el almacenamiento no está disponible, se usa solo memoria. */
function loadReadIds(): string[] {
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function saveReadIds(ids: string[]): void {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* sin almacenamiento: la lectura dura lo que dure la sesión */
  }
}

/** Campana de la barra superior con las notificaciones del usuario. */
export function NotificationsBell() {
  const [readIds, setReadIds] = useState<string[]>(loadReadIds);

  const { data: pending } = useQuery({
    queryKey: ['legal', 'pending'],
    queryFn: async () => (await api.get<PendingDocument[]>('/legal/pending/')).data,
    refetchInterval: 60_000,
  });

  const items = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];
    (pending ?? []).forEach((doc, index) => {
      const id = `legal-${doc.id ?? index}`;
      list.push({
        id,
        title: doc.title ?? 'Documento legal pendiente',
        body: 'Aceptá la versión vigente para seguir operando.',
        to: '/legal',
      });
    });
    return list;
  }, [pending]);

  const unread = items.filter((item) => !readIds.includes(item.id));

  const markRead = useCallback((ids: string[]) => {
    setReadIds((current) => {
      const next = Array.from(new Set([...current, ...ids]));
      saveReadIds(next);
      return next;
    });
  }, []);

  return (
    <Popover className="relative">
      <>
          <PopoverButton
            aria-label={unread.length ? `Notificaciones, ${unread.length} sin leer` : 'Notificaciones'}
            className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-surface transition hover:-translate-y-px hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Bell className="h-4 w-4" />
            {unread.length > 0 && (
              <span className="notif-badge" aria-hidden="true">{unread.length}</span>
            )}
          </PopoverButton>

          <PopoverPanel
            anchor={{ to: 'bottom end', gap: 10 }}
            transition
            className={`notif-panel z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-4 shadow-xl transition duration-200 ease-out data-[closed]:translate-y-1 data-[closed]:opacity-0`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">Notificaciones</h2>
                <Adaptive
                  as="p"
                  className="text-[11px] text-muted"
                  simple={unread.length ? `${unread.length} sin leer` : 'Al día'}
                  detailed={unread.length
                    ? `${unread.length} sin leer. Se marcan como leídas al abrirlas en este dispositivo.`
                    : 'No hay avisos pendientes en este dispositivo.'}
                />
              </div>
              {unread.length > 0 && (
                <button
                  type="button"
                  onClick={() => markRead(items.map((i) => i.id))}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Marcar leídas
                </button>
              )}
            </div>

            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {items.length === 0 && (
                <li className="notif-empty">
                  <Inbox className="h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold">Todo en orden</p>
                  <p className="text-xs text-muted">Cuando haya algo para revisar, aparece acá.</p>
                </li>
              )}
              {items.map((item) => {
                const isUnread = !readIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <Link
                      to={item.to}
                      onClick={() => markRead([item.id])}
                      className={`flex items-start gap-3 rounded-xl border p-3 transition hover:border-primary/40 ${isUnread ? 'border-primary/25 bg-primary/5' : 'border-line/70 bg-canvas/40'}`}
                    >
                      <span className="feature-icon feature-icon--amber shrink-0"><FileCheck2 size={18} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {item.title}
                          {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Sin leer" />}
                        </span>
                        <Adaptive as="span" className="mt-0.5 block text-xs leading-5 text-muted" simple="Aceptá la versión vigente." detailed={item.body} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </PopoverPanel>
      </>
    </Popover>
  );
}
