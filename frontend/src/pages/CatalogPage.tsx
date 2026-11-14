import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Copy, IdCard, Stethoscope, UserPlus, Users } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useSession } from '../context/SessionContext';
import { Adaptive } from '../components/ui/Adaptive';

interface Patient { id: string; full_name: string; document_number: string; address: string; health_insurance: string | null; is_active: boolean; }
interface Professional { id: string; full_name: string; license_number: string; specialty: string; is_active: boolean; }
interface HealthInsurance { id: string; name: string; }

const SPECIALTIES: { value: string; label: string }[] = [
  { value: 'ENFERMERO', label: 'Enfermero' },
  { value: 'CUIDADOR', label: 'Cuidador' },
  { value: 'KINESIOLOGO', label: 'Kinesiólogo' },
];
const WRITE_ROLES = ['TENANT_OWNER', 'TENANT_ADMIN'];
const stagger = (index: number) => ({ '--i': index } as CSSProperties);

/** Fichas de pacientes y prestadores. Cada ficha muestra su ID para usarlo en la importación de visitas. */
export function CatalogPage() {
  const { activeMembership } = useSession();
  const canWrite = WRITE_ROLES.includes(activeMembership?.role ?? '');
  const [tab, setTab] = useState<'patients' | 'professionals'>('patients');

  return (
    <div className="bento">
      <section className="welcome-panel bento-in col-span-12 xl:col-span-6" style={stagger(0)}>
        <div className="welcome-glow welcome-glow--two" />
        <div className="relative z-10 max-w-md">
          <p className="eyebrow eyebrow--light"><IdCard size={13} /> Fichas</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">Pacientes y prestadores</h1>
          <Adaptive as="p" className="mt-3 text-sm leading-6 text-white/75" simple="Copiá el ID para importar visitas." detailed="Cada ficha tiene un ID único. Al importar visitas por CSV o Excel, usá esos IDs en las columnas paciente_id y prestador_id." />
          <Link to="/importar" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/15">
            Ir a importar visitas
          </Link>
        </div>
      </section>

      <section className="card bento-in col-span-12 xl:col-span-6 space-y-4" style={stagger(1)}>
        <div role="tablist" aria-label="Tipo de ficha" className="inline-flex rounded-xl border border-line bg-canvas/50 p-1">
          <TabButton active={tab === 'patients'} onClick={() => setTab('patients')} icon={<Users size={15} />} label="Pacientes" />
          <TabButton active={tab === 'professionals'} onClick={() => setTab('professionals')} icon={<Stethoscope size={15} />} label="Prestadores" />
        </div>
        {tab === 'patients'
          ? <PatientsPanel canWrite={canWrite} />
          : <ProfessionalsPanel canWrite={canWrite} />}
      </section>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${active ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink'}`}>
      {icon} {label}
    </button>
  );
}

/** Botón que copia el ID y confirma con un ícono. */
function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button type="button" onClick={copy} aria-label={`Copiar ID ${value}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 font-mono text-[11px] text-muted transition hover:border-primary/40 hover:text-primary">
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      <span className="max-w-[9rem] truncate sm:max-w-none">{value}</span>
    </button>
  );
}

function PatientsPanel({ canWrite }: { canWrite: boolean }) {
  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => (await api.get<Patient[]>('patients/')).data,
  });
  return (
    <div className="space-y-4">
      {canWrite && <PatientForm />}
      {isLoading && <p className="text-sm text-muted">Cargando…</p>}
      {!isLoading && (patients ?? []).length === 0 && <p className="text-sm text-muted">Todavía no hay pacientes cargados.</p>}
      <ul className="space-y-2">
        {(patients ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/70 bg-canvas/40 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{p.full_name}</p>
              <p className="text-xs text-muted">Documento {p.document_number} {p.is_active ? '' : '· inactivo'}</p>
            </div>
            <CopyId value={p.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfessionalsPanel({ canWrite }: { canWrite: boolean }) {
  const { data: professionals, isLoading } = useQuery({
    queryKey: ['professionals'],
    queryFn: async () => (await api.get<Professional[]>('professionals/')).data,
  });
  return (
    <div className="space-y-4">
      {canWrite && <ProfessionalForm />}
      {isLoading && <p className="text-sm text-muted">Cargando…</p>}
      {!isLoading && (professionals ?? []).length === 0 && <p className="text-sm text-muted">Todavía no hay prestadores cargados.</p>}
      <ul className="space-y-2">
        {(professionals ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/70 bg-canvas/40 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{p.full_name}</p>
              <p className="text-xs text-muted">{SPECIALTIES.find((s) => s.value === p.specialty)?.label ?? p.specialty} · matrícula {p.license_number}</p>
            </div>
            <CopyId value={p.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PatientForm() {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [document, setDocument] = useState('');
  const [address, setAddress] = useState('');
  const [insuranceId, setInsuranceId] = useState('');
  const { data: insurances } = useQuery({
    queryKey: ['health-insurances'],
    queryFn: async () => (await api.get<HealthInsurance[]>('health-insurances/')).data,
  });
  const create = useMutation({
    mutationFn: () => api.post('patients/', {
      full_name: fullName, document_number: document, address,
      health_insurance: insuranceId || null, is_active: true,
    }),
    onSuccess: () => {
      setFullName(''); setDocument(''); setAddress(''); setInsuranceId('');
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
  function onSubmit(e: FormEvent) { e.preventDefault(); create.mutate(); }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:grid-cols-2">
      <p className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><UserPlus size={16} className="text-primary" /> Nuevo paciente</p>
      <label className="grid gap-1 text-xs font-semibold text-muted">Nombre y apellido
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={200} /></label>
      <label className="grid gap-1 text-xs font-semibold text-muted">Documento
        <input className="input" value={document} onChange={(e) => setDocument(e.target.value)} required maxLength={32} /></label>
      <label className="grid gap-1 text-xs font-semibold text-muted">Domicilio
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} /></label>
      <label className="grid gap-1 text-xs font-semibold text-muted">Obra social
        <select className="input" value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)}>
          <option value="">Sin obra social</option>
          {(insurances ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select></label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button className="btn-primary" type="submit" disabled={create.isPending}>Guardar paciente</button>
        {create.isError && <p role="alert" className="text-xs font-semibold text-danger">{errorMessage(create.error)}</p>}
      </div>
    </form>
  );
}

function ProfessionalForm() {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [license, setLicense] = useState('');
  const [specialty, setSpecialty] = useState('ENFERMERO');
  const create = useMutation({
    mutationFn: () => api.post('professionals/', { full_name: fullName, license_number: license, specialty, is_active: true }),
    onSuccess: () => {
      setFullName(''); setLicense('');
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    },
  });
  function onSubmit(e: FormEvent) { e.preventDefault(); create.mutate(); }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:grid-cols-2">
      <p className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><UserPlus size={16} className="text-primary" /> Nuevo prestador</p>
      <label className="grid gap-1 text-xs font-semibold text-muted">Nombre y apellido
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={200} /></label>
      <label className="grid gap-1 text-xs font-semibold text-muted">Matrícula
        <input className="input" value={license} onChange={(e) => setLicense(e.target.value)} required maxLength={64} /></label>
      <label className="grid gap-1 text-xs font-semibold text-muted">Especialidad
        <select className="input" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
          {SPECIALTIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select></label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button className="btn-primary" type="submit" disabled={create.isPending}>Guardar prestador</button>
        {create.isError && <p role="alert" className="text-xs font-semibold text-danger">{errorMessage(create.error)}</p>}
      </div>
    </form>
  );
}
