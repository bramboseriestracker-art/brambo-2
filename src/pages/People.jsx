import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAsync, useDebounced, useTitle } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import UserRow from '../components/UserRow.jsx';

export default function People() {
  useTitle('Friends');
  const { user } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim().replace(/^@/, ''), 150);
  const res = useAsync(() => (dq.length >= 1 ? api(`/users/search?q=${encodeURIComponent(dq)}`) : { users: [] }), [dq]);
  const active = useAsync(() => api('/users/active'), []);
  const copy = async () => { try { await navigator.clipboard.writeText(user.bid); toast('Brambo ID copied.'); } catch { toast(user.bid); } };

  return (
    <main className="app-main"><div className="wrap narrow">
      <h1 className="page-title">Find friends</h1>
      <p className="page-sub">Search by username or Brambo ID. Share your own ID so friends can find you.</p>
      <div className="composer idcard"><div><span className="lab">Your Brambo ID</span><b className="bid">{user.bid}</b></div><button type="button" className="btn btn-ghost btn-compact" onClick={copy}>Copy ID</button></div>
      <input type="search" className="filter-input wide" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username or Brambo ID" aria-label="Search people" autoComplete="off" />
      <div className="people-res">
        {dq.length < 1 ? (
          <>
            <h2 className="row-title" style={{ marginTop: 28 }}>Most active users</h2>
            <p className="sec-sub">Members who logged, rated and reviewed the most in the last 30 days.</p>
            {active.loading ? <div className="row-status"><p>Loading…</p></div> : active.error ? <div className="row-status"><p>{active.error.message}</p></div>
              : active.data.users.length ? <ul className="user-list">{active.data.users.map((u) => <UserRow key={u.id} u={u} />)}</ul>
              : <div className="row-status"><p>No other members yet. Share your Brambo ID with friends.</p></div>}
          </>
        ) : res.loading ? <div className="row-status"><p>Searching…</p></div>
          : res.error ? <div className="row-status"><p>{res.error.message}</p></div>
          : res.data.users.length ? <ul className="user-list">{res.data.users.map((u) => <UserRow key={u.id} u={u} />)}</ul>
          : <div className="row-status"><p>No users found for "{dq}".</p></div>}
      </div>
    </div></main>
  );
}
