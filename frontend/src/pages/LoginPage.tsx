import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, session } from '../lib/api';
import { useSession } from '../context/SessionContext';
import { ThemeToggleButton } from '../theme/ThemeToggleButton';
import { TurnstileWidget } from '../components/auth/TurnstileWidget';
import { PasswordField } from '../components/ui/PasswordField';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post<{ access: string; user: Parameters<typeof setUser>[0] }>(
        '/auth/login/', { email, password, turnstile_token: turnstileToken },
      );
      session.setAccessToken(data.access);
      setUser(data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, t('auth.invalid')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="absolute right-4 top-4"><ThemeToggleButton /></div>
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="font-display text-2xl font-extrabold">{t('auth.title')}</h1>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">{t('auth.email')}</span>
          <input type="email" required autoComplete="username" className="input"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">{t('auth.password')}</span>
          <PasswordField required autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <div aria-label={t('auth.antiBot')}>
          <TurnstileWidget onToken={setTurnstileToken} />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={submitting || !turnstileToken}>
          {t('auth.submit')}
        </button>
      </form>
      <div className="absolute bottom-4 flex gap-4 text-sm">
        <Link to="/register" className="text-primary">Crear cuenta</Link>
        <Link to="/password/reset" className="text-primary">Olvidé mi contraseña</Link>
      </div>
    </main>
  );
}
