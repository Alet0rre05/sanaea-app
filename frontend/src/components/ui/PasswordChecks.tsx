import { useTranslation } from 'react-i18next';
import { passwordChecks } from '../../lib/passwordRules';

/** Checks visuales de contraseña: se iluminan en verde al cumplirse. */
export function PasswordChecks({ password }: { password: string }) {
  const { t } = useTranslation();
  const checks = passwordChecks(password);
  const items = [
    { ok: checks.minLength, label: t('password.minLength') },
    { ok: checks.noTripleRepeat, label: t('password.noTripleRepeat') },
  ];
  return (
    <ul className="mt-2 space-y-1 text-sm" aria-live="polite">
      {items.map((item) => (
        <li key={item.label} className={item.ok ? 'text-success' : 'text-muted'}>
          <span aria-hidden="true">{item.ok ? '✓' : '○'}</span> {item.label}
        </li>
      ))}
    </ul>
  );
}
