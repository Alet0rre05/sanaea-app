import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../lib/api';

interface LegalDocument { id: string; kind: string; version: number; title: string; body: string; content_hash: string }

/** Muestra los documentos legales vigentes pendientes y registra su aceptación. */
export function LegalAcceptancePage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ['legal', 'pending'],
    queryFn: async () => (await api.get<LegalDocument[]>('/legal/pending/')).data,
  });

  const accept = async (id: string) => {
    setError(null);
    try {
      await api.post('/legal/accept/', { document_id: id });
      await queryClient.invalidateQueries({ queryKey: ['legal', 'pending'] });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (isLoading) return <p className="p-6 text-sm text-muted">Cargando…</p>;
  if (data.length === 0) return null;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">Documentos legales</h1>
      {data.map((doc) => (
        <article key={doc.id} className="card space-y-3">
          <h2 className="font-display text-lg font-bold">{doc.title} · v{doc.version}</h2>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm">{doc.body}</pre>
          <p className="kpi-number text-xs text-muted">SHA-256: {doc.content_hash}</p>
          <button type="button" className="btn-primary" onClick={() => accept(doc.id)}>Acepto</button>
        </article>
      ))}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
