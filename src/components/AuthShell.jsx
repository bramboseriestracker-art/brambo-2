import { useEffect } from 'react';
import { Wall } from '../pages/Auth.jsx';
import Brand from './Brand.jsx';
import '../styles/auth.css';

/* Shared frame for the account pages: poster wall, brand and a centred card. */
export default function AuthShell({ title, copy, children }) {
  useEffect(() => { document.body.classList.add('auth'); return () => document.body.classList.remove('auth'); }, []);
  return (
    <>
      <Wall /><div className="scrim" />
      <Brand to="/" className="auth-brand" />
      <main className="auth-shell">
        <div className="auth-copy"><h1>{title}</h1><p>{copy}</p></div>
        <section className="auth-card">{children}</section>
      </main>
    </>
  );
}
