import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { passwordChecks } from '../lib/passwordRules';
import { PasswordChecks } from '../components/ui/PasswordChecks';
import { PasswordField } from '../components/ui/PasswordField';
import { TurnstileWidget } from '../components/auth/TurnstileWidget';

/** Pantallas de registro, verificación de cuenta y recuperación de contraseña. */

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-sm space-y-4">
        <h1 className="font-display text-2xl font-extrabold">{title}</h1>
        {children}
        <Link to="/login" className="block text-center text-sm text-primary">Volver a ingresar</Link>
      </div>
    </main>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const checks = passwordChecks(password);
  const valid = checks.minLength && checks.noTripleRepeat;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/register/', {
        email, password, first_name: firstName, last_name: lastName, turnstile_token: token,
      });
      navigate(`/verify?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Crear cuenta">
      <form onSubmit={submit} className="space-y-3">
        <input className="input" placeholder="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="input" placeholder="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <input className="input" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField required autoComplete="new-password" placeholder="Contraseña"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordChecks password={password} />
        <TurnstileWidget onToken={setToken} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !valid || !token}>Registrarme</button>
      </form>
    </Shell>
  );
}

export function VerifyPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [email] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/auth/verify-registration/', { email, code, turnstile_token: token });
      navigate('/login');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Shell title="Verificar cuenta">
      <p className="text-sm text-muted">Ingresá el código de 6 dígitos que enviamos a {email || 'tu correo'}.</p>
      <form onSubmit={submit} className="space-y-3">
        <input className="input kpi-number" inputMode="numeric" maxLength={6} pattern="\d{6}" required
          placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
        <TurnstileWidget onToken={setToken} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={!token || code.length !== 6}>Verificar</button>
      </form>
    </Shell>
  );
}

export function PasswordResetPage() {
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checks = passwordChecks(password);
  const valid = checks.minLength && checks.noTripleRepeat;

  const request = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/auth/password/reset/request/', { email, turnstile_token: token });
      setStep('confirm');
      setMessage('Si la cuenta existe, recibirás un código.');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/auth/password/reset/confirm/', {
        email, code, new_password: password, turnstile_token: token,
      });
      setMessage('Contraseña actualizada. Ya podés ingresar.');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Shell title="Recuperar contraseña">
      {step === 'request' ? (
        <form onSubmit={request} className="space-y-3">
          <input className="input" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TurnstileWidget onToken={setToken} />
          <button type="submit" className="btn-primary w-full" disabled={!token}>Enviar código</button>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-3">
          <input className="input kpi-number" inputMode="numeric" maxLength={6} required placeholder="Código"
            value={code} onChange={(e) => setCode(e.target.value)} />
          <PasswordField required autoComplete="new-password" placeholder="Nueva contraseña"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordChecks password={password} />
          <TurnstileWidget onToken={setToken} />
          <button type="submit" className="btn-primary w-full" disabled={!token || !valid || code.length !== 6}>Cambiar contraseña</button>
        </form>
      )}
      {message && <p className="text-sm text-success">{message}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </Shell>
  );
}
