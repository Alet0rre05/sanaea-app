import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';

/** Widget flotante (inferior derecha) para hablar con AJR Data. El backend sanitiza el texto. */
export function SupportWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/support/messages/', { body });
      setBody('');
      setStatus({ ok: true, text: t('support.sent') });
    } catch (error) {
      setStatus({ ok: false, text: errorMessage(error, t('common.error')) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-3 z-40 md:bottom-6 md:right-6">
      {open && (
        <div role="dialog" aria-label={t('support.title')} className="card mb-3 w-72 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <strong className="font-display">{t('support.title')}</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('common.cancel')}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea className="input min-h-24" value={body} maxLength={4000}
            placeholder={t('support.placeholder')} onChange={(e) => setBody(e.target.value)} />
          {status && (
            <p className={`text-xs ${status.ok ? 'text-success' : 'text-danger'}`}>{status.text}</p>
          )}
          <button type="button" className="btn-primary w-full" onClick={send} disabled={sending || !body.trim()}>
            {t('support.send')}
          </button>
        </div>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="btn-primary h-12 w-12 rounded-full p-0 shadow-xl" aria-label={t('support.open')}>
        <MessageCircle className="h-5 w-5" />
      </button>
    </div>
  );
}
