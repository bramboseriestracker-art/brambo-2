import { useState } from 'react';
import { api, tmdb } from '../lib/api.js';
import { useAsync, useTitle } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import ReviewCard from '../components/ReviewCard.jsx';

const Empty = ({ children }) => <div className="row-status"><p>{children}</p></div>;

export default function Reviews() {
  useTitle('Reviews');
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('community');
  const mine = useAsync(() => api(`/reviews?user=me&limit=50`), []);
  const comm = useAsync(() => api('/reviews?limit=30'), []);
  const ext = useAsync(async () => {
    const shows = (await tmdb('tv/top_rated')).results.slice(0, 12);
    const res = await Promise.allSettled(shows.map((s) => tmdb(`tv/${s.id}/reviews`).then((r) => r.results.slice(0, 1).map((x) => ({ _id: `${s.id}-${x.id}`, tvId: s.id, name: s.name, poster_path: s.poster_path, by: x.author, rating: x.author_details?.rating, text: x.content, createdAt: x.created_at })))));
    return res.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  }, []);

  const del = async (id) => { try { await api(`/reviews/${id}`, { method: 'DELETE' }); toast('Review deleted.'); mine.reload(); comm.reload(); } catch (e) { toast(e.message); } };

  return (
    <main className="app-main"><div className="wrap">
      <h1 className="page-title">Reviews</h1>
      <p className="page-sub">Write your own and read what others say.</p>
      <div className="composer"><h2>Write a review</h2><p className="page-sub">Search a series in the top bar, open it and post your review from its page. It appears here and on your profile.</p></div>
      <div className="seg" role="tablist">
        {[['community', 'Brambo community'], ['mine', 'Your reviews'], ['tmdb', 'From TMDB']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'community' && (comm.loading ? <Empty>Loading…</Empty> : comm.error ? <Empty>Could not load reviews.</Empty> : comm.data.items.length
        ? <div className="rv-list">{comm.data.items.map((r) => <ReviewCard key={r._id} r={r} onDelete={r.user === user.id ? () => del(r._id) : undefined} />)}</div> : <Empty>No reviews yet. Be the first to review a series.</Empty>)}
      {tab === 'mine' && (mine.loading ? <Empty>Loading…</Empty> : mine.error ? <Empty>Could not load your reviews.</Empty> : mine.data.items.length
        ? <div className="rv-list">{mine.data.items.map((r) => <ReviewCard key={r._id} r={r} onDelete={() => del(r._id)} />)}</div> : <Empty>You have not reviewed anything yet.</Empty>)}
      {tab === 'tmdb' && (ext.loading ? <Empty>Loading…</Empty> : ext.error ? <Empty>Could not load reviews from TMDB.</Empty> : ext.data.length
        ? <div className="rv-list">{ext.data.map((r) => <ReviewCard key={r._id} r={r} />)}</div> : <Empty>No reviews available right now.</Empty>)}
    </div></main>
  );
}
