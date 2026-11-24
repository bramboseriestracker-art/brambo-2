import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync, useTitle } from '../lib/hooks.js';
import UserRow from '../components/UserRow.jsx';

export default function Connections({ kind }) {
  const { handle } = useParams();
  const [pg, setPg] = useState(1);
  const r = useAsync(() => api(`/users/${handle}/${kind}?page=${pg}`), [handle, kind, pg]);
  useTitle(`${handle} ${kind}`);
  return (
    <main className="app-main"><div className="wrap narrow">
      <p className="crumb"><Link to={`/u/${handle}`}>{handle}</Link></p>
      <h1 className="page-title">{kind === 'followers' ? 'Followers' : 'Following'}</h1>
      <p className="page-sub">{r.data ? `${r.data.total} ${r.data.total === 1 ? 'person' : 'people'}` : ' '}</p>
      <div className="seg"><Link className={kind === 'followers' ? 'on' : ''} to={`/u/${handle}/followers`}>Followers</Link><Link className={kind === 'following' ? 'on' : ''} to={`/u/${handle}/following`}>Following</Link></div>
      {r.loading ? <div className="row-status"><p>Loading…</p></div> : r.error ? <div className="row-status"><p>{r.error.message}</p></div>
        : r.data.users.length ? <ul className="user-list">{r.data.users.map((u) => <UserRow key={u.id} u={u} />)}</ul> : <div className="row-status"><p>{kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p></div>}
      {r.data?.pages > 1 && <div className="pager"><button className="btn btn-ghost btn-compact" disabled={pg <= 1} onClick={() => setPg(pg - 1)}>Previous</button><span>Page {pg} of {r.data.pages}</span><button className="btn btn-ghost btn-compact" disabled={pg >= r.data.pages} onClick={() => setPg(pg + 1)}>Next</button></div>}
    </div></main>
  );
}
