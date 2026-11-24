import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync, useTitle } from '../lib/hooks.js';
import PosterCard from '../components/PosterCard.jsx';

const NAMES = { watchlist: 'Watch list', later: 'Watch later', favourites: 'Favourites' };

export default function ListPage() {
  const { handle, list } = useParams();
  const [pg, setPg] = useState(1);
  const ok = NAMES[list];
  const r = useAsync(() => (ok ? api(`/lists/${list}?user=${encodeURIComponent(handle)}&page=${pg}`) : Promise.reject(new Error('Unknown list.'))), [handle, list, pg]);
  useTitle(`${handle} ${ok || ''}`);
  const items = (r.data?.items || []).map((i) => ({ id: i.tvId, name: i.name, poster_path: i.posterPath, pct: list === 'watchlist' && i.seasons ? Math.min(100, ((i.loggedSeasons || 0) / i.seasons) * 100) : null, meta: list === 'watchlist' ? [`${i.loggedSeasons || 0} of ${i.seasons || '?'} seasons logged`] : [] }));
  return (
    <main className="app-main"><div className="wrap">
      <p className="crumb"><Link to={`/u/${handle}`}>{r.data?.owner?.username || handle}</Link></p>
      <h1 className="page-title">{ok || 'List'}</h1>
      <div className="seg">{Object.entries(NAMES).map(([k, l]) => <Link key={k} className={k === list ? 'on' : ''} to={`/u/${handle}/list/${k}`}>{l}</Link>)}</div>
      {r.loading ? <div className="row-status"><p>Loading…</p></div> : r.error ? <div className="row-status"><p>{r.error.message}</p></div>
        : items.length ? <ul className="poster-grid">{items.map((i) => <PosterCard key={i.id} item={i} />)}</ul> : <div className="row-status"><p>Nothing here yet.</p></div>}
      {r.data?.pages > 1 && <div className="pager"><button className="btn btn-ghost btn-compact" disabled={pg <= 1} onClick={() => setPg(pg - 1)}>Previous</button><span>Page {pg} of {r.data.pages}</span><button className="btn btn-ghost btn-compact" disabled={pg >= r.data.pages} onClick={() => setPg(pg + 1)}>Next</button></div>}
    </div></main>
  );
}
