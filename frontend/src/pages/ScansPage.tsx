import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../lib/api';
import { SplitScreenValidator, type ScanRecord } from '../components/ocr/SplitScreenValidator';
import { Sensitive } from '../components/ui/Sensitive';

export function ScansPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ScanRecord | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: scans = [], isLoading } = useQuery({
    queryKey: ['scans'],
    queryFn: async () => (await api.get<ScanRecord[]>('/scans/')).data,
  });

  const upload = async (file: File) => {
    setUploadError(null);
    const form = new FormData();
    form.append('image', file);
    try {
      const { data } = await api.post<ScanRecord>('/scans/', form);
      await queryClient.invalidateQueries({ queryKey: ['scans'] });
      setSelected(data);
    } catch (err) {
      setUploadError(errorMessage(err, t('common.error')));
    }
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm text-primary" onClick={() => setSelected(null)}>
          ← {t('scan.title')}
        </button>
        <SplitScreenValidator
          scan={selected}
          onValidated={() => {
            setSelected(null);
            void queryClient.invalidateQueries({ queryKey: ['scans'] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">{t('scan.title')}</h1>
        <label className="btn-primary cursor-pointer">
          {t('scan.upload')}
          <input type="file" accept="image/jpeg,image/png" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        </label>
      </header>
      {uploadError && <p role="alert" className="text-sm text-danger">{uploadError}</p>}
      {isLoading && <p className="text-sm text-muted">{t('common.loading')}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {scans.map((scan) => (
          <li key={scan.id}>
            <button type="button" onClick={() => setSelected(scan)} className="card w-full text-left">
              <span className={scan.status === 'VALIDATED' ? 'badge-ok' : 'badge-pending'}>
                {scan.status === 'VALIDATED' ? t('scan.validated') : t('scan.pending')}
              </span>
              <Sensitive>
                <p className="kpi-number mt-2 text-sm text-muted">{scan.id.slice(0, 8)}</p>
              </Sensitive>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
