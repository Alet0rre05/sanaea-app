import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../../lib/api';
import { useAutosave } from '../../hooks/useAutosave';
import { Sensitive } from '../ui/Sensitive';

export interface ScanRecord {
  id: string;
  status: 'PENDING_REVIEW' | 'VALIDATED';
  payload: Record<string, string | number | null>;
  image_url: string;
}

/**
 * Validación OCR en pantalla dividida: mitad izquierda, la planilla con zoom;
 * mitad derecha, el formulario extraído, editable. Los borradores se autoguardan.
 */
export function SplitScreenValidator({ scan, onValidated }: { scan: ScanRecord; onValidated: () => void }) {
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fields, setFields] = useState(scan.payload);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { restored, discard } = useAutosave(`scan-${scan.id}`, fields);
  const readOnly = scan.status === 'VALIDATED';

  // La imagen requiere el token de acceso: se descarga como blob.
  useEffect(() => {
    let objectUrl: string | null = null;
    api.get(scan.image_url, { responseType: 'blob' }).then((response) => {
      objectUrl = URL.createObjectURL(response.data as Blob);
      setImageUrl(objectUrl);
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [scan.image_url]);

  const validate = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/scans/${scan.id}/validate/`, { corrections: fields });
      await discard();
      onValidated();
    } catch (err) {
      setError(errorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card overflow-hidden p-0" aria-label={t('scan.original')}>
        <div className="flex items-center justify-between border-b border-line/80 px-4 py-2 text-sm">
          <span className="font-semibold">{t('scan.original')}</span>
          <label className="flex items-center gap-2 text-muted">
            {t('scan.zoom')}
            <input type="range" min={1} max={3} step={0.1} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
        </div>
        <div className="h-[60vh] overflow-auto bg-canvas">
          {imageUrl ? (
            <img src={imageUrl} alt={t('scan.original')} style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              className="max-w-none" />
          ) : (
            <p className="p-6 text-sm text-muted">{t('common.loading')}</p>
          )}
        </div>
      </section>

      <section className="card space-y-3" aria-label={t('scan.extracted')}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t('scan.extracted')}</h2>
          <span className={readOnly ? 'badge-ok' : 'badge-pending'}>
            {readOnly ? t('scan.validated') : t('scan.pending')}
          </span>
        </div>
        {restored && !readOnly && (
          <p className="text-xs text-muted">{t('common.draftFound')}</p>
        )}
        {Object.keys(fields).length === 0 && (
          <p className="text-sm text-muted">{t('scan.extracted')}: —</p>
        )}
        {Object.entries(fields).map(([key, value]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block text-muted">{key}</span>
            <Sensitive>
              <input className="input kpi-number" value={value ?? ''} disabled={readOnly}
                onChange={(e) => setFields({ ...fields, [key]: e.target.value })} />
            </Sensitive>
          </label>
        ))}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {!readOnly && (
          <button type="button" className="btn-primary w-full" onClick={validate} disabled={saving}>
            {t('scan.validate')}
          </button>
        )}
      </section>
    </div>
  );
}
