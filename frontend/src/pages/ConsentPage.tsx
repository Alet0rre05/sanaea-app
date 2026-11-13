import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eraser, FileSignature } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Adaptive } from '../components/ui/Adaptive';

interface FamilyLink { id: string; patient: string; relationship: string; verified_at: string | null; }
interface LegalDoc { id: string; title: string; version: string; kind: string; }

/** Firma informada en pantalla. La firma y la aceptación quedan registradas de forma inmutable. */
export function ConsentPage() {
  const { data: links } = useQuery({
    queryKey: ['family-links'],
    queryFn: async () => (await api.get<FamilyLink[]>('family-links/')).data,
  });
  const { data: docs } = useQuery({
    queryKey: ['legal', 'documents'],
    queryFn: async () => (await api.get<LegalDoc[]>('legal/documents/')).data,
  });

  const verifiedLinks = (links ?? []).filter((l) => l.verified_at);
  const [patientId, setPatientId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [hasInk, setHasInk] = useState(false);
  const [done, setDone] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const selectedPatient = patientId || verifiedLinks[0]?.patient || '';
  const selectedDocument = documentId || docs?.[0]?.id || '';

  const sign = useMutation({
    mutationFn: () => {
      const dataUrl = canvasRef.current?.toDataURL('image/png') ?? '';
      return api.post('legal/informed-consent/', {
        patient_id: selectedPatient,
        document_id: selectedDocument,
        signature_data: dataUrl,
      });
    },
    onSuccess: () => { setDone(true); clear(); },
  });

  function point(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#108E69';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasInk(true);
  }

  function onUp() { drawing.current = false; }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  if (verifiedLinks.length === 0) {
    return (
      <section className="card bento-in space-y-2">
        <p className="eyebrow">Consentimiento informado</p>
        <p className="text-sm font-semibold">Todavía no tenés un vínculo verificado</p>
        <p className="text-xs text-muted">Verificá tu vínculo con el paciente antes de firmar.</p>
      </section>
    );
  }

  return (
    <div className="bento">
      <section className="card bento-in col-span-12 xl:col-span-5 space-y-4" style={{ '--i': 0 } as CSSProperties}>
        <p className="eyebrow">Consentimiento informado</p>
        <h1 className="font-display text-xl font-bold tracking-tight">Firmá en pantalla</h1>
        <Adaptive as="p" className="text-xs leading-5 text-muted" simple="Elegí paciente, documento y firmá." detailed="Tu firma queda asociada a la versión exacta del documento y a la fecha. No puede modificarse después." />
        <label className="grid gap-1 text-xs font-semibold text-muted">
          Paciente
          <select className="input" value={selectedPatient} onChange={(e) => setPatientId(e.target.value)}>
            {verifiedLinks.map((l) => <option key={l.id} value={l.patient}>{l.relationship || 'Paciente'} · {l.patient.slice(0, 8)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          Documento
          <select className="input" value={selectedDocument} onChange={(e) => setDocumentId(e.target.value)}>
            {(docs ?? []).map((d) => <option key={d.id} value={d.id}>{d.title} · v{d.version}</option>)}
          </select>
        </label>
      </section>

      <section className="card bento-in col-span-12 xl:col-span-7 space-y-3" style={{ '--i': 1 } as CSSProperties}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-bold"><FileSignature size={17} className="text-primary" /> Tu firma</span>
          <button type="button" onClick={clear} disabled={!hasInk} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-canvas disabled:opacity-40">
            <Eraser size={14} /> Limpiar
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={640}
          height={220}
          aria-label="Área de firma"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          className="signature-pad w-full touch-none rounded-xl border border-dashed border-line bg-canvas/60"
        />
        <button type="button" className="btn-primary w-full sm:w-auto" disabled={!hasInk || !selectedPatient || !selectedDocument || sign.isPending} onClick={() => sign.mutate()}>
          {sign.isPending ? 'Guardando…' : 'Firmar y guardar'}
        </button>
        {done && <p role="status" className="text-sm font-semibold text-success">Consentimiento registrado.</p>}
        {sign.isError && <p role="alert" className="text-sm font-semibold text-danger">{errorMessage(sign.error)}</p>}
      </section>
    </div>
  );
}
