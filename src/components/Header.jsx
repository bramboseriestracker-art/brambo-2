import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { tmdb, img } from '../lib/api.js';
import { loadIndex, rankLocal, merge, norm } from '../lib/search.js';
import { useClickOutside } from '../lib/hooks.js';
import Avatar from './Avatar.jsx';
import Brand from './Brand.jsx';

function Highlight({ text, q }) {
  const i = norm(text).indexOf(q);
  if (!q || i !== 0 || !text.toLowerCase().startsWith(q.trim().toLowerCase())) return text;
  return <><mark>{text.slice(0, q.trim().length)}</mark>{text.slice(q.trim().length)}</>;
}

function SearchBox() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [hot, setHot] = useState(-1);
  const box = useRef(null);
  const seq = useRef(0);
  const index = useRef([]);
  useClickOutside(box, () => setOpen(false));
  useEffect(() => { loadIndex().then((l) => { index.current = l; }); }, []);

  const onChange = (value) => {
    setQ(value);
    const nq = norm(value);
    const id = ++seq.current;
    setHot(-1);
    if (!nq) { setItems([]); setBusy(false); setOpen(false); return; }
    /* 1. instant: local index. 2. a moment later: live TMDB results merged in. */
    const local = rankLocal(index.current, nq);
    setItems(local); setOpen(true); setBusy(true);
    setTimeout(async () => {
      if (id !== seq.current) return;
      try {
        const d = await tmdb('search/tv', { query: value.trim() });
        if (id === seq.current) setItems(merge(local, d.results, nq));
      } catch { /* keep local results */ }
      if (id === seq.current) setBusy(false);
    }, 90);
  };

  const go = (id) => { setOpen(false); setQ(''); setItems([]); nav(`/series/${id}`); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHot((h) => Math.min(items.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHot((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter' && items.length) { e.preventDefault(); go(items[hot >= 0 ? hot : 0].id); }
    else if (e.key === 'Escape') setOpen(false);
  };
  const nq = norm(q);

  return (
    <div className="nav-search" ref={box} role="search">
      <input type="search" value={q} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} onFocus={() => { loadIndex().then((l) => { index.current = l; }); if (items.length) setOpen(true); }}
        placeholder="Search series" aria-label="Search series" aria-expanded={open} aria-controls="search-results" autoComplete="off" />
      {open && (
        <ul className="search-pop" id="search-results" role="listbox">
          {items.length ? items.map((x, i) => (
            <li key={x.id} role="option" aria-selected={i === hot}>
              <button type="button" className={i === hot ? 'hot' : ''} onMouseEnter={() => setHot(i)} onClick={() => go(x.id)}>
                <img src={img(x.poster_path, 'w92')} alt="" />
                <span><Highlight text={x.name} q={nq} /><small>{x.year}</small></span>
              </button>
            </li>))
            : <li className="none">{busy ? 'Searching…' : 'No series found'}</li>}
        </ul>
      )}
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [solid, setSolid] = useState(false);
  const um = useRef(null);
  useClickOutside(um, () => setMenu(false));
  useEffect(() => { setMobile(false); setMenu(false); }, [pathname]);
  useEffect(() => {
    const f = () => setSolid(window.scrollY > 40);
    f(); window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const hero = pathname === '/home';
  const isAdmin = user.role === 'admin';
  const links = isAdmin ? [['/admin', 'Admin'], ['/home', 'Home'], ['/editors', "Editor's choice"], ['/people', 'Friends']] : [['/home', 'Home'], ['/editors', "Editor's choice"], ['/reviews', 'Reviews'], ['/people', 'Friends']];

  return (
    <header className={'site-header' + (!hero || solid ? ' is-scrolled' : '')}>
      <div className="wrap header-inner">
        <Brand to={isAdmin ? '/admin' : '/home'} />
        <button type="button" className="menu-toggle" aria-expanded={mobile} aria-label="Toggle navigation menu" onClick={() => setMobile((v) => !v)}><span className="menu-bars" /></button>
        <div className={'site-menu' + (mobile ? ' is-open' : '')}>
          <nav className="site-nav" aria-label="Main">
            <ul className="nav-list">{links.map(([to, label]) => <li key={to}><NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink></li>)}</ul>
          </nav>
          <SearchBox />
          <div className="nav-user" ref={um}>
            <button type="button" className="avatar-btn" aria-label="Account menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><Avatar user={user} /></button>
            {menu && (
              <div className="user-menu">
                {isAdmin && <Link to="/admin">Admin dashboard</Link>}
                <Link to={`/u/${user.username}`}>Profile</Link>
                <Link to={`/u/${user.username}/diary`}>Diary</Link>
                <Link to={`/u/${user.username}/list/watchlist`}>Watch list</Link>
                <Link to={`/u/${user.username}/list/later`}>Watch later</Link>
                <Link to={`/u/${user.username}/list/favourites`}>Favourites</Link>
                <button type="button" onClick={logout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
