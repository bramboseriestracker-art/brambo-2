import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, img, fmtDate, fmtTime } from '../lib/api.js';
import { useAsync, useTitle } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import Popcorn from '../components/Popcorn.jsx';

export default function Diary() {
  const { handle } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [pg, setPg] = useState(1);
  const r = useAsync(() => api(`/diary?user=${encodeURIComponent(handle)}&page=${pg}&limit=50`), [handle, pg]);
  useTitle(`${handle}'s diary`);
  const isMe = user.username.toLowerCase() === handle.toLowerCase() || user.bid === handle.toUpperCase();

  const groups = useMemo(() => {
    const m = new Map();
    (r.data?.items || []).forEach((e) => { const d = new Date(e.watchedOn); const k = d.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'long', year: 'numeric' }); if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
    return [...m.entries()];
  }, [r.data]);

  const del = async (e) => {
    if (!window.confirm(`Remove ${e.name}, season ${e.season} from your diary?`)) return;
    try { await api(`/diary/${e._id}`, { method: 'DELETE' }); toast('Entry removed.'); r.reload(); } catch (x) { toast(x.message); }
  };

  return (
    <main className="app-main"><div className="wrap narrow">
      <p className="crumb"><Link to={`/u/${handle}`}>{r.data?.owner?.username || handle}</Link></p>
      <h1 className="page-title">Diary</h1>
      <p className="page-sub">{r.data ? `${r.data.total} season${r.data.total === 1 ? '' : 's'} logged` : ' '}</p>
      {r.loading ? <div className="row-status"><p>Loading…</p></div> : r.error ? <div className="row-status"><p>{r.error.message}</p></div>
        : !groups.length ? <div className="row-status"><p>No seasons logged yet.</p>{isMe && <Link className="btn btn-ghost btn-compact" to="/editors">Find a series</Link>}</div>
        : groups.map(([month, list]) => (
          <section className="d-month" key={month}>
            <h2>{month}</h2>
            <ul className="d-list">{list.map((e) => (
              <li className="d-row" key={e._id}>
                <span className="d-date">{fmtDate(e.watchedOn, { day: 'numeric', month: 'short' })}</span>
                <Link to={`/series/${e.tvId}`} className="d-poster">{e.posterPath ? <img src={img(e.posterPath, 'w154')} alt="" loading="lazy" /> : null}</Link>
                <div className="d-main">
                  <Link to={`/series/${e.tvId}`} className="d-title">{e.name}</Link>
                  <span className="d-season">Season {e.season} <small>{e.episodeCount} episodes | {fmtTime(e.episodeCount * e.runtime)}{e.rewatch ? ' | Rewatch' : ''}</small></span>
                  {e.note && <p className="d-note">{e.note}</p>}
                </div>
                {e.rating ? <Popcorn value={e.rating} size={16} label="Season rating" /> : <span />}
                {isMe && <button type="button" className="more danger" onClick={() => del(e)}>Remove</button>}
              </li>))}
            </ul>
          </section>))}
      {r.data?.pages > 1 && <div className="pager"><button className="btn btn-ghost btn-compact" disabled={pg <= 1} onClick={() => setPg(pg - 1)}>Previous</button><span>Page {pg} of {r.data.pages}</span><button className="btn btn-ghost btn-compact" disabled={pg >= r.data.pages} onClick={() => setPg(pg + 1)}>Next</button></div>}
    </div></main>
  );
}
