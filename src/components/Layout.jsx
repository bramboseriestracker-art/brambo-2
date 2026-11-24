import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import Header from './Header.jsx';
import Footer from './Footer.jsx';

export function ProtectedLayout() {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="boot" role="status">Loading…</div>;
  if (!user) return <Navigate to={`/auth?mode=login&next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}

/* Admin-only pages. The server also checks the role on every /api/admin call. */
export function AdminOnly() {
  const { user } = useAuth();
  return user.role === 'admin' ? <Outlet /> : <Navigate to="/home" replace />;
}

export function Status({ loading, error, children, empty }) {
  if (loading) return <div className="row-status"><p>Loading…</p></div>;
  if (error) return <div className="row-status"><p>{error.message || 'Something went wrong.'}</p></div>;
  if (empty) return <div className="row-status"><p>{empty}</p></div>;
  return children;
}
