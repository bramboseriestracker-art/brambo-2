import { useEffect, useState } from 'react';
import { api, fmtDate, fmtTime } from '../lib/api.js';
import { useAsync, useDebounced, useTitle } from '../lib/hooks.js';
import { useToast } from '../lib/toast.jsx';
import Dialog from '../components/Dialog.jsx';
import Avatar from '../components/Avatar.jsx';

const n = (v) => Number(v || 0).toLocaleString();
const ago = (d) => {
  if (!d) return 'Never';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 90) return 'Just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return fmtDate(d);
};

function Metric({ value, label, note }) { return <div className="metric"><b>{value}</b><span>{label}</span>{note && <small>{note}</small>}</div>; }

function Overview({ o }) {
  const max = Math.max(1, ...o.signups.map((s) => s.count));
  const u = o.users, c = o.content;
  return (
    <>
      <div className="admin-grid">
        <Metric value={n(u.total)} label="Registered users" note={`${n(u.new7)} new this week`} />
        <Metric value={n(u.active7)} label="Active in last 7 days" note={u.total ? `${Math.round((u.active7 / u.total) * 100)}% of users` : ''} />
        <Metric value={n(u.verified)} label="Verified emails" note={`${n(u.unverified)} pending`} />
        <Metric value={n(u.new30)} label="New in 30 days" />
        <Metric value={n(c.logs)} label="Seasons logged" note={`${n(c.shows)} different series`} />
        <Metric value={n(c.episodes)} label="Episodes watched" note={fmtTime(c.minutes) + ' watched in total'} />
        <Metric value={n(c.reviews)} label="Reviews" />
        <Metric value={n(c.seriesRatings + c.episodeRatings)} label="Popcorn ratings" note={`${n(c.seriesRatings)} series, ${n(c.episodeRatings)} episodes`} />
        <Metric value={n(c.watchlist + c.later + c.favourites)} label="List entries" note={`${n(c.watchlist)} watch list, ${n(c.later)} later, ${n(c.favourites)} favourites`} />
        <Metric value={n(c.follows)} label="Follow connections" />
      </div>
      <div className="admin-two">
        <div className="admin-card">
          <h2>Sign-ups, last 14 days</h2>
          <div className="bars" role="img" aria-label="Sign-ups per day for the last 14 days">
            {o.signups.map((s) => (
              <div key={s.date} title={`${s.date}: ${s.count}`}><em>{s.count || ''}</em><i style={{ height: `${(s.count / max) * 100}%` }} /><span>{s.date.slice(8)}</span></div>
            ))}
          </div>
        </div>
        <div className="admin-card">
          <h2>Most logged series</h2>
          {o.topSeries.length ? <ol className="top-list">{o.topSeries.map((s) => <li key={s.tvId}><span>{s.name}</span><b>{s.logs}</b></li>)}</ol> : <p className="muted">No diary entries yet.</p>}
          <h2 style={{ marginTop: 22 }}>Most active users</h2>
          {o.topUsers.length ? <ol className="top-list">{o.topUsers.map((s) => <li key={s.bid || s.username}><span>{s.username}</span><b>{s.logs}</b></li>)}</ol> : <p className="muted">No activity yet.</p>}
        </div>
      </div>
    </>
  );
}

function UserDialog({ id, onClose, onDeleted }) {
  const toast = useToast();
  const r = useAsync(() => (id ? api(`/admin/users/${id}`) : null), [id]);
  const [busy, setBusy] = useState(false);
  const u = r.data?.user;
  const del = async () => {
    if (!window.confirm(`Delete ${u.username} and all of their data? This cannot be undone.`)) return;
    setBusy(true);
    try { await api(`/admin/users/${id}`, { method: 'DELETE' }); toast('User deleted.'); onDeleted(); onClose(); }
    catch (x) { toast(x.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!id} onClose={onClose} label="User details" className="dialog-wide">
      {r.loading || !u ? <p>Loading…</p> : (
        <>
          <h2 className="dialog-title">{u.username}</h2>
          <dl className="kv">
            <dt>Email</dt><dd>{u.email} <span className={'badge ' + (u.emailVerified ? 'yes' : 'no')}>{u.emailVerified ? 'Verified' : 'Not verified'}</span></dd>
            <dt>Brambo ID</dt><dd>{u.bid}</dd>
            <dt>Joined</dt><dd>{fmtDate(u.createdAt)}</dd>
            <dt>Last login</dt><dd>{ago(u.lastLoginAt)} ({u.loginCount} logins)</dd>
            <dt>Followers / following</dt><dd>{u.followers} / {u.following}</dd>
            <dt>Seasons logged</dt><dd>{u.stats.logs} ({u.stats.episodes} episodes, {fmtTime(u.stats.minutes)})</dd>
            <dt>Reviews</dt><dd>{u.stats.reviews}</dd>
            <dt>Ratings</dt><dd>{u.stats.seriesRatings} series, {u.stats.episodeRatings} episodes</dd>
            <dt>Lists</dt><dd>{u.stats.watchlist} watch list, {u.stats.later} watch later, {u.stats.favourites} favourites</dd>
            {u.bio && <><dt>Bio</dt><dd>{u.bio}</dd></>}
          </dl>
          <h3 style={{ marginTop: 16 }}>Recent diary entries</h3>
          {r.data.recent.length ? <ul className="top-list" style={{ marginTop: 8 }}>{r.data.recent.map((e) => <li key={e._id}><span>{e.name}, Season {e.season}</span><span>{fmtDate(e.watchedOn)}</span></li>)}</ul> : <p className="muted">None.</p>}
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-danger btn-compact" onClick={del} disabled={busy}>Delete user</button>
            <button type="button" className="btn btn-ghost btn-compact" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export default function Admin() {
  useTitle('Admin');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');
  const [verified, setVerified] = useState('');
  const [pg, setPg] = useState(1);
  const [open, setOpen] = useState(null);
  const dq = useDebounced(q.trim(), 250);
  useEffect(() => setPg(1), [dq, sort, verified]);

  const over = useAsync(() => api('/admin/overview'), []);
  const users = useAsync(() => api(`/admin/users?q=${encodeURIComponent(dq)}&sort=${sort}&verified=${verified}&page=${pg}&limit=20`), [dq, sort, verified, pg]);

  return (
    <main className="app-main"><div className="wrap">
      <h1 className="page-title">Admin dashboard</h1>
      <p className="page-sub">Users and platform statistics{over.data ? `, updated ${ago(over.data.generatedAt)}` : ''}.
        {' '}<button type="button" className="link-btn" onClick={() => { over.reload(); users.reload(); }}>Refresh</button></p>
      {over.loading ? <div className="row-status"><p>Loading statistics…</p></div> : over.error ? <div className="row-status"><p>{over.error.message}</p></div> : <Overview o={over.data} />}

      <h2 className="row-title" style={{ marginTop: 40 }}>All users</h2>
      <div className="admin-tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username, email or Brambo ID" aria-label="Search users" style={{ minWidth: 280 }} />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort users">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="username">Username A-Z</option><option value="followers">Most followers</option><option value="login">Last login</option>
        </select>
        <select value={verified} onChange={(e) => setVerified(e.target.value)} aria-label="Filter by email status">
          <option value="">All emails</option><option value="yes">Verified</option><option value="no">Not verified</option>
        </select>
      </div>
      {users.loading && !users.data ? <div className="row-status"><p>Loading users…</p></div> : users.error ? <div className="row-status"><p>{users.error.message}</p></div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>User</th><th>Email</th><th>Joined</th><th>Last login</th><th>Seasons</th><th>Time watched</th><th>Reviews</th><th>Ratings</th><th>Lists</th><th>Followers</th></tr></thead>
            <tbody>
              {users.data.users.map((u) => (
                <tr key={u.id} onClick={() => setOpen(u.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(u.id)}>
                  <td><div className="who"><Avatar user={{ username: u.username }} size="xs" /><span>{u.username}<small>{u.bid}</small></span></div></td>
                  <td>{u.email}<br /><span className={'badge ' + (u.emailVerified ? 'yes' : 'no')}>{u.emailVerified ? 'Verified' : 'Pending'}</span></td>
                  <td>{fmtDate(u.createdAt)}</td><td>{ago(u.lastLoginAt)}</td>
                  <td>{u.stats.logs}</td><td>{fmtTime(u.stats.minutes)}</td><td>{u.stats.reviews}</td>
                  <td>{u.stats.seriesRatings + u.stats.episodeRatings}</td>
                  <td>{u.stats.watchlist + u.stats.later + u.stats.favourites}</td><td>{u.followers}</td>
                </tr>))}
              {!users.data.users.length && <tr><td colSpan={10} className="muted">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {users.data?.pages > 1 && <div className="pager"><button className="btn btn-ghost btn-compact" disabled={pg <= 1} onClick={() => setPg(pg - 1)}>Previous</button><span>Page {pg} of {users.data.pages} ({users.data.total} users)</span><button className="btn btn-ghost btn-compact" disabled={pg >= users.data.pages} onClick={() => setPg(pg + 1)}>Next</button></div>}
      <UserDialog id={open} onClose={() => setOpen(null)} onDeleted={() => { users.reload(); over.reload(); }} />
    </div></main>
  );
}
