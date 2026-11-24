import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { useTitle } from '../lib/hooks.js';
import AuthShell from '../components/AuthShell.jsx';

export default function VerifyEmail() {
  useTitle('Verify your email');
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const timer = useRef();
  useEffect(() => { if (wait <= 0) return; timer.current = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(timer.current); }, [wait]);

  if (!user) return <Navigate to="/auth?mode=login" replace />;
  if (user.emailVerified) return <Navigate to={user.role === 'admin' ? '/admin' : '/home'} replace />;

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setNote('');
    if (!/^\d{6}$/.test(code)) return setErr('Enter the 6-digit code from the email.');
    setBusy(true);
    try { const d = await api('/auth/verify-email', { method: 'POST', body: { code } }); setUser(d.user); nav('/home', { replace: true }); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  const resend = async () => {
    setErr(''); setNote('');
    try { await api('/auth/resend-verification', { method: 'POST' }); setNote('A new code is on its way.'); setWait(60); }
    catch (x) { setErr(x.message); const m = /(\d+) seconds/.exec(x.message); if (m) setWait(Number(m[1])); }
  };

  return (
    <AuthShell title="Confirm your email." copy="This keeps your account secure and lets you recover it if you forget your password.">
      <form onSubmit={submit} noValidate>
        <p className="hint">We sent a 6-digit code to <b>{user.email}</b>. It expires in 15 minutes.</p>
        <label className="field"><span>Verification code</span>
          <input className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
        </label>
        <p className="err" role="alert">{err}</p>
        {note && <p className="ok" role="status">{note}</p>}
        <button className="btn btn-primary btn-large" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Verify email'}</button>
        <p className="auth-links">
          <button type="button" onClick={resend} disabled={wait > 0}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
          <button type="button" onClick={logout}>Use a different account</button>
        </p>
      </form>
    </AuthShell>
  );
}
