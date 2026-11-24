import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { tmdb, img, shuffle } from '../lib/api.js';
import { useTitle } from '../lib/hooks.js';
import { emailError, suggestEmail, passwordError, passwordStrength } from '../lib/validate.js';
import Brand from '../components/Brand.jsx';
import '../styles/auth.css';

const GAP = 14, SPEED = 30;

export function Wall() {
  const [posters, setPosters] = useState([]);
  const [w, setW] = useState(window.innerWidth);
  const [h, setH] = useState(window.innerHeight);
  useEffect(() => {
    let live = true;
    Promise.all([1, 2, 3, 4, 5, 6].map((p) => tmdb('tv/popular', { page: p }))).then((pages) => {
      const list = [...new Set(pages.flatMap((p) => p.results).map((r) => r.poster_path).filter(Boolean))];
      if (live && list.length >= 60) setPosters(shuffle(list));
    }).catch(() => {});
    let t; const on = () => { clearTimeout(t); t = setTimeout(() => { setW(innerWidth); setH(innerHeight); }, 300); };
    addEventListener('resize', on);
    return () => { live = false; removeEventListener('resize', on); };
  }, []);
  if (!posters.length) return <div id="wall" aria-hidden="true" />;
  const n = w > 1200 ? 8 : w > 800 ? 6 : w > 520 ? 4 : 3, cw = (w - GAP * (n - 1)) / n, ch = cw * 1.5, per = Math.ceil(h / (ch + GAP)) + 2;
  return (
    <div id="wall" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const half = (k) => <div className="half" key={k}>{Array.from({ length: per }, (_, j) => <img key={j} alt="" src={img(posters[(j * n + i) % posters.length], cw > 200 ? 'w342' : 'w185')} onLoad={(e) => e.target.classList.add('in')} />)}</div>;
        return <div className="col" key={i}><div className={'track' + (i % 2 ? ' rev' : '')} style={{ animationDuration: `${((ch + GAP) * per) / SPEED}s` }}>{half(0)}{half(1)}</div></div>;
      })}
    </div>
  );
}

export default function Auth() {
  const { user, login, signup } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const mode = sp.get('mode') === 'login' ? 'login' : 'signup';
  const next = sp.get('next');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useRef(null);
  useTitle(mode === 'login' ? 'Log in' : 'Sign up');
  useEffect(() => { document.body.classList.add('auth'); return () => document.body.classList.remove('auth'); }, []);
  useEffect(() => setErr(''), [mode]);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/home';
  const landing = (u) => (u.role === 'admin' ? '/admin' : !u.emailVerified ? '/verify-email' : dest);
  if (user) return <Navigate to={landing(user)} replace />;
  const typo = mode === 'signup' ? suggestEmail(email) : '';

  const submit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(form.current));
    setErr('');
    try {
      if (mode === 'login') {
        if (!v.id.trim() || !v.pw) return setErr('Enter your username or email and password.');
        setBusy(true); await login(v.id.trim(), v.pw);
      } else {
        const name = v.user.trim(), mail = v.email.trim().toLowerCase();
        if (!/^[A-Za-z0-9_.]{3,20}$/.test(name)) return setErr('Username must be 3-20 letters, numbers, dots or underscores.');
        const ee = emailError(mail); if (ee) return setErr(ee);
        const pe = passwordError(v.pw); if (pe) return setErr(pe);
        if (v.pw !== v.pw2) return setErr('Passwords do not match.');
        setBusy(true); const u = await signup({ username: name, email: mail, password: v.pw });
        return nav(landing(u), { replace: true });
      }
      /* login: the redirect happens through the `user` check above (admin -> /admin) */
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  const fields = mode === 'login'
    ? [['id', 'Username or email', 'text', 'username'], ['pw', 'Password', 'password', 'current-password']]
    : [['user', 'Username', 'text', 'username'], ['email', 'Email', 'email', 'email'], ['pw', 'Password', 'password', 'new-password'], ['pw2', 'Confirm password', 'password', 'new-password']];

  return (
    <>
      <Wall /><div className="scrim" />
      <Brand to="/" className="auth-brand" />
      <main className="auth-shell">
        <div className="auth-copy"><h1>Every show you watch, in one place.</h1><p>Log seasons, rate episodes in popcorn and see what your friends are watching.</p></div>
        <section className="auth-card">
          <div className="tabs" role="tablist">
            {['login', 'signup'].map((m) => <button key={m} type="button" role="tab" aria-selected={m === mode} onClick={() => setSp({ mode: m, ...(next ? { next } : {}) }, { replace: true })}>{m === 'login' ? 'Log in' : 'Sign up'}</button>)}
          </div>
          <form ref={form} onSubmit={submit} noValidate key={mode}>
            {fields.map(([n, l, t, a]) => (
              <label className="field" key={n}><span>{l}</span>
                <input name={n} type={t} autoComplete={a} required
                  {...(mode === 'signup' && n === 'email' ? { value: email, onChange: (e) => setEmail(e.target.value), inputMode: 'email', autoCapitalize: 'none', spellCheck: false } : {})}
                  {...(mode === 'signup' && n === 'pw' ? { value: pw, onChange: (e) => setPw(e.target.value) } : {})} />
                {mode === 'signup' && n === 'email' && typo && <span className="suggest">Did you mean <button type="button" className="link-btn" onClick={() => setEmail(typo)}>{typo}</button>?</span>}
                {mode === 'signup' && n === 'pw' && <span className="pw-meter" data-s={passwordStrength(pw)} aria-hidden="true"><span /></span>}
              </label>))}
            {mode === 'signup' && <p className="hint">Use at least 8 characters with a letter and a number. We will email a 6-digit code to confirm your address.</p>}
            <p className="err" role="alert">{err}</p>
            <button className="btn btn-primary btn-large" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
            {mode === 'login' && <p className="auth-links"><Link to="/forgot-password">Forgot password?</Link><button type="button" onClick={() => setSp({ mode: 'signup' }, { replace: true })}>Create an account</button></p>}
          </form>
        </section>
      </main>
    </>
  );
}
