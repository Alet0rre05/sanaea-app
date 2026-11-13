import { useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BadgeCheck, Mail, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Adaptive } from '../components/ui/Adaptive';

interface FamilyLink {
  id: string;
  patient: string;
  relationship: string;
  verified_at: string | null;
}

/** Vínculo del familiar con su paciente. Se verifica con un código enviado por correo. */
export function FamilyLinksPage() {
  const { data: links, isLoading } = useQuery({
    queryKey: ['family-links'],
    queryFn: async () => (await api.get<FamilyLink[]>('family-links/')).data,
  });

  return (
    <div className="bento">
      <section className="card bento-in col-span-12 space-y-2" style={{ '--i': 0 } as CSSProperties}>
        <p className="eyebrow">Vínculos familiares</p>
        <h1 className="font-display text-xl font-bold tracking-tight">Tu paciente vinculado</h1>
        <Adaptive as="p" className="text-xs leading-5 text-muted" simple="Verificá el vínculo para ver visitas y firmar." detailed="Pedí un código y revisá tu correo. Solo después de verificar el vínculo podés ver las visitas del paciente y firmar consentimientos." />
      </section>

      {isLoading && <p className="col-span-12 text-sm text-muted">Cargando…</p>}
      {!isLoading && (links ?? []).length === 0 && (
        <section className="card bento-in col-span-12 notif-empty" style={{ '--i': 1 } as CSSProperties}>
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">No hay vínculos asignados</p>
          <p className="text-xs text-muted">La agencia debe asignar tu vínculo con el paciente.</p>
        </section>
      )}

      {(links ?? []).map((link, index) => (
        <LinkCard key={link.id} link={link} delay={index + 1} />
      ))}

      {(links ?? []).some((l) => l.verified_at) && (
        <Link to="/consentimiento" className="card bento-in bento-tile col-span-12 sm:col-span-6 xl:col-span-4" style={{ '--i': 9 } as CSSProperties}>
          <span className="feature-icon feature-icon--blue"><BadgeCheck size={20} /></span>
          <h2 className="mt-4 text-sm font-bold">Firmar consentimiento</h2>
          <p className="mt-1 text-xs text-muted">Firmá en pantalla el documento vigente.</p>
        </Link>
      )}
    </div>
  );
}

function LinkCard({ link, delay }: { link: FamilyLink; delay: number }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const verified = Boolean(link.verified_at);

  const requestCode = useMutation({
    mutationFn: () => api.post(`family-links/${link.id}/request-code/`),
    onSuccess: () => setSent(true),
  });

  const verify = useMutation({
    mutationFn: () => api.post(`family-links/${link.id}/verify/`, { code }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['family-links'] }),
  });

  return (
    <section className="card bento-in col-span-12 sm:col-span-6 xl:col-span-4 space-y-3" style={{ '--i': delay } as CSSProperties}>
      <div className="flex items-center justify-between gap-2">
        <span className={`feature-icon ${verified ? 'feature-icon--mint' : 'feature-icon--amber'}`}><ShieldCheck size={19} /></span>
        <span className={verified ? 'badge-ok' : 'badge-pending'}>{verified ? 'Verificado' : 'Pendiente'}</span>
      </div>
      <div>
        <h2 className="text-sm font-bold">{link.relationship || 'Familiar'}</h2>
        <Adaptive as="p" className="text-xs text-muted" simple="Paciente vinculado" detailed={`Paciente ${link.patient.slice(0, 8)}…. Verificado ${verified ? 'el ' + new Date(link.verified_at as string).toLocaleDateString('es-AR') : 'no'}.`} />
      </div>

      {!verified && (
        <div className="space-y-2">
          <button type="button" className="btn-primary w-full" onClick={() => requestCode.mutate()} disabled={requestCode.isPending}>
            <Mail className="mr-2 h-4 w-4" /> {sent ? 'Reenviar código' : 'Enviar código al correo'}
          </button>
          {sent && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); verify.mutate(); }}>
              <input className="input tracking-[0.35em] tabular-nums" inputMode="numeric" maxLength={6} placeholder="000000"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Código de verificación" />
              <button className="btn-primary shrink-0" type="submit" disabled={code.length !== 6 || verify.isPending}>Verificar</button>
            </form>
          )}
          {(requestCode.isError || verify.isError) && (
            <p role="alert" className="text-xs font-semibold text-danger">{errorMessage(requestCode.error ?? verify.error)}</p>
          )}
        </div>
      )}
    </section>
  );
}
