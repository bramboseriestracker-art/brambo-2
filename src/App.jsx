import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { ProtectedLayout, AdminOnly } from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import Editors from './pages/Editors.jsx';
import Reviews from './pages/Reviews.jsx';
import Series from './pages/Series.jsx';
import Person from './pages/Person.jsx';
import Profile from './pages/Profile.jsx';
import Diary from './pages/Diary.jsx';
import ListPage from './pages/ListPage.jsx';
import People from './pages/People.jsx';
import Connections from './pages/Connections.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Admin from './pages/Admin.jsx';

/* New page = start at the top (otherwise the previous scroll position carries over and e.g. a series opens at its cast). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [pathname]);
  return null;
}

function ProfileRedirect() { const { user } = useAuth(); return <Navigate to={`/u/${user.username}`} replace />; }
function Missing() { return <main className="app-main"><div className="wrap"><div className="row-status"><p>Page not found.</p><Link className="btn btn-ghost btn-compact" to="/">Go home</Link></div></div></main>; }
const Followers = () => <Connections kind="followers" />;
const Following = () => <Connections kind="following" />;

export default function App() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/editors" element={<Editors />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/series/:id" element={<Series />} />
        <Route path="/person/:id" element={<Person />} />
        <Route path="/people" element={<People />} />
        <Route path="/profile" element={<ProfileRedirect />} />
        <Route path="/u/:handle" element={<Profile />} />
        <Route path="/u/:handle/diary" element={<Diary />} />
        <Route path="/u/:handle/list/:list" element={<ListPage />} />
        <Route path="/u/:handle/followers" element={<Followers />} />
        <Route path="/u/:handle/following" element={<Following />} />
        <Route element={<AdminOnly />}>
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Missing />} />
      </Route>
    </Routes>
    </>
  );
}
