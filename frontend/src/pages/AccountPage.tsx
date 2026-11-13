import { useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldAlert, UserRound } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useSession } from '../context/SessionContext';
import { Adaptive } from '../components/ui/Adaptive';

type Field = 'email' | 'backup_email' | 'username';

interface Me {
  email: string;
  username: string;
  backup_email: string;
  first_name: string;
  last_name: string;
}

const FIELD_LABEL: Record<Field, string> = {
  email: 'Email de la cuenta',
  backup_email: 'Email de respaldo',
  username: 'Nombre de usuario',
};

/** Datos de la cuenta y cambios sensibles con verificación por código. */
export function AccountPage() {
  const { activeMembership } = useSession();
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<Me>('me/')).data,
  });

  const [field, setField] = useState<Field>('email');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const requestChange = useMutation({
    mutationFn: () => api.post('me/change/request/', { field, value }),
    onSuccess: () => {
      setAwaitingCode(true);
      setNotice({ kind: 'ok', text: 'Enviamos un código de 6 dígitos al email de la cuenta.' });
    },
    onError: (error) => setNotice({ kind: 'error', text: errorMessage(error) }),
  });

  const confirmChange = useMutation({
    mutationFn: () => api.post('me/change/confirm/', { field, value, code }),
    onSuccess: () => {
      setAwaitingCode(false);
      setValue('');
      setCode('');
      setNotice({ kind: 'ok', text: `${FIELD_LABEL[field]} actualizado.` });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error) => setNotice({ kind: 'error', text: errorMessage(error) }),
  });

  const isOwner = activeMembership?.role === 'TENANT_OWNER';

  return (
    <div className="bento">
      <section className="card bento-in col-span-12 xl:col-span-5 space-y-4" style={{ '--i': 0 } as CSSProperties}>
        <div className="flex items-center gap-3">
          <span className="feature-icon feature-icon--mint"><UserRound size={19} /></span>
          <div>
            <p className="eyebrow">Mi cuenta</p>
            <h1 className="font-display text-lg font-bold tracking-tight">Datos de acceso</h1>
          </div>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[11px] font-semibold text-muted">Nombre</dt><dd className="font-semibold">{me ? `${me.first_name} ${me.last_name}`.trim() || '—' : '…'}</dd></div>
          <div><dt className="text-[11px] font-semibold text-muted">Usuario</dt><dd className="font-semibold">{me?.username || '—'}</dd></div>
          <div><dt className="text-[11px] font-semibold text-muted">Email</dt><dd className="break-all font-semibold">{me?.email || '—'}</dd></div>
          <div><dt className="text-[11px] font-semibold text-muted">Respaldo</dt><dd className="break-all font-semibold">{me?.backup_email || 'Sin configurar'}</dd></div>
        </dl>
        <Adaptive as="p" className="text-xs leading-5 text-muted" simple="Cambios sensibles con código." detailed="Cambiar el email, el respaldo o el usuario requiere confirmar un código enviado al email de la cuenta. Así evitamos cambios no autorizados." />
      </section>

      <section className="card bento-in col-span-12 xl:col-span-7 space-y-4" style={{ '--i': 1 } as CSSProperties}>
        <div className="flex items-center gap-3">
          <span className="feature-icon feature-icon--violet"><KeyRound size={19} /></span>
          <h2 className="font-display text-lg font-bold tracking-tight">Cambiar datos</h2>
        </div>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); requestChange.mutate(); }}>
          <label className="grid gap-1 text-xs font-semibold text-muted">
            Qué querés cambiar
            <select className="input" value={field} onChange={(e) => { setField(e.target.value as Field); setAwaitingCode(false); }}>
              {(Object.keys(FIELD_LABEL) as Field[]).map((f) => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">
            Nuevo valor
            <input className="input" value={value} onChange={(e) => setValue(e.target.value)} required maxLength={254} />
          </label>
          <div className="sm:col-span-2">
            <button className="btn-primary" type="submit" disabled={!value || requestChange.isPending}>
              {requestChange.isPending ? 'Enviando…' : 'Enviar código'}
            </button>
          </div>
        </form>

        {awaitingCode && (
          <form className="grid gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); confirmChange.mutate(); }}>
            <label className="grid gap-1 text-xs font-semibold text-muted">
              Código de 6 dígitos
              <input className="input tracking-[0.4em] tabular-nums" inputMode="numeric" pattern="\d{6}" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" required />
            </label>
            <button className="btn-primary" type="submit" disabled={code.length !== 6 || confirmChange.isPending}>Confirmar cambio</button>
          </form>
        )}

        {notice && (
          <p role="status" className={`text-sm font-semibold ${notice.kind === 'ok' ? 'text-success' : 'text-danger'}`}>{notice.text}</p>
        )}
      </section>

      {isOwner && <WithdrawalSection />}
    </div>
  );
}

/** Baja de la agencia activa. Solo TENANT_OWNER. Requiere escribir el nombre de la agencia. */
function WithdrawalSection() {
  const { activeMembership, logout } = useSession();
  const [reason, setReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const tenantName = activeMembership?.tenant_name ?? '';
  const canSubmit = confirmName.trim() === tenantName && tenantName.length > 0;

  const withdraw = useMutation({
    mutationFn: () => api.post('legal/withdrawal/', { reason }),
    onSuccess: async () => { await logout(); },
  });

  return (
    <section className="card bento-in col-span-12 space-y-4 border-danger/30" style={{ '--i': 2 } as CSSProperties}>
      <div className="flex items-center gap-3">
        <span className="feature-icon feature-icon--amber"><ShieldAlert size={19} /></span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Dar de baja la agencia</h2>
          <Adaptive as="p" className="text-xs text-muted" simple="Acción irreversible." detailed={`La baja de «${tenantName}» es irreversible. Se registra de forma inmutable y cierra el acceso de todo el equipo.`} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold text-muted">
          Motivo (opcional)
          <textarea className="input min-h-[92px]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          Escribí «{tenantName}» para confirmar
          <input className="input" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </label>
      </div>
      {withdraw.isError && <p role="alert" className="text-sm font-semibold text-danger">{errorMessage(withdraw.error)}</p>}
      <button type="button" disabled={!canSubmit || withdraw.isPending}
        onClick={() => withdraw.mutate()}
        className="inline-flex items-center justify-center rounded-xl border border-danger/50 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-40">
        {withdraw.isPending ? 'Procesando…' : 'Dar de baja'}
      </button>
    </section>
  );
}
