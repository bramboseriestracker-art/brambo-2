import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useTitle } from '../lib/hooks.js';
import { emailError, passwordError, passwordStrength } from '../lib/validate.js';
import AuthShell from '../components/AuthShell.jsx';

export default function ForgotPassword() {
  useTitle('Reset password');
  const nav = useNavigate();
  const [step, setStep] = useState('request'); // request -> reset -> done
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const timer = useRef();
  useEffect(() => { if (wait <= 0) return; timer.current = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(timer.current); }, [wait]);

  const request = async (e) => {
    e?.preventDefault(); setErr(''); setNote('');
    const ee = emailError(email); if (ee) return setErr(ee);
    setBusy(true);
    try { const d = await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } }); setNote(d.message); setStep('reset'); setWait(60); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const reset = async (e) => {
    e.preventDefault(); setErr('');
    if (!/^\d{6}$/.test(code)) return setErr('Enter the 6-digit code from the email.');
    const pe = passwordError(pw); if (pe) return setErr(pe);
    if (pw !== pw2) return setErr('Passwords do not match.');
    setBusy(true);
    try { await api('/auth/reset-password', { method: 'POST', body: { email: email.trim(), code, password: pw } }); setStep('done'); setTimeout(() => nav('/auth?mode=login', { replace: true }), 2500); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Forgot your password?" copy="Enter the email you signed up with and we will send a code to set a new one.">
      {step === 'request' && (
        <form onSubmit={request} noValidate>
          <label className="field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required /></label>
          <p className="err" role="alert">{err}</p>
          <button className="btn btn-primary btn-large" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button>
          <p className="auth-links"><Link to="/auth?mode=login">Back to log in</Link></p>
        </form>
      )}
      {step === 'reset' && (
        <form onSubmit={reset} noValidate>
          <p className="hint">{note} It expires in 15 minutes.</p>
          <label className="field"><span>6-digit code</span><input className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus /></label>
          <label className="field"><span>New password</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><span className="pw-meter" data-s={passwordStrength(pw)} aria-hidden="true"><span /></span></label>
          <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          <p className="err" role="alert">{err}</p>
          <button className="btn btn-primary btn-large" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</button>
          <p className="auth-links"><button type="button" onClick={() => { setNote(''); request(); }} disabled={wait > 0 || busy}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button><Link to="/auth?mode=login">Back to log in</Link></p>
        </form>
      )}
      {step === 'done' && (
        <div><p className="ok" role="status">Password updated. Taking you to the login page…</p><Link className="btn btn-primary btn-large" to="/auth?mode=login">Log in now</Link></div>
      )}
    </AuthShell>
  );
}
