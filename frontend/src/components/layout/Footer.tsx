import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-10 py-6 text-center text-xs text-muted">
      {t('app.signature')}{' '}
      <a href="https://ajrdata.com.ar" target="_blank" rel="noreferrer"
        className="font-semibold text-clinical transition hover:text-clinical-soft hover:underline">
        AJR DATA
      </a>
    </footer>
  );
}
