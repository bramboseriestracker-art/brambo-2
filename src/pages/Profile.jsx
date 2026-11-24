import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, img, fmtDate, fmtTime } from '../lib/api.js';
import { useAsync, useTitle } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import Avatar from '../components/Avatar.jsx';
import Dialog from '../components/Dialog.jsx';
import FollowButton from '../components/FollowButton.jsx';
import PosterCard from '../components/PosterCard.jsx';
import { prepareImage } from '../lib/image.js';
import Popcorn from '../components/Popcorn.jsx';
import ReviewCard from '../components/ReviewCard.jsx';

function EditDialog({ open, onClose, me, onSaved }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const [bio, setBio] = useState(me.bio);
  const [av, setAv] = useState(null);
  const [bn, setBn] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      let u = (await api('/me/profile', { method: 'PUT', body: { bio } })).user;
      if (av) u = (await api('/me/media/avatar', { method: 'PUT', body: { dataUrl: await prepareImage(av, 512, 512) } })).user;
      if (bn) u = (await api('/me/media/banner', { method: 'PUT', body: { dataUrl: await prepareImage(bn, 1600, 533) } })).user;
      setUser(u); toast('Profile updated.'); onSaved(); onClose();
    } catch (x) { toast(x.message); } finally { setBusy(false); }
  };
  const remove = async (kind) => { try { setUser((await api(`/me/media/${kind}`, { method: 'DELETE' })).user); onSaved(); toast('Image removed.'); } catch (x) { toast(x.message); } };
  return (
    <Dialog open={open} onClose={onClose} label="Edit profile">
      <h2 className="dialog-title">Edit profile</h2>
      <form className="field-row" onSubmit={save} style={{ marginTop: 16 }}>
        <label>Profile picture (any size)<input type="file" accept="image/*" onChange={(e) => setAv(e.target.files[0] || null)} /></label>
        {me.avatar && <button type="button" className="more" onClick={() => remove('avatar')}>Remove picture</button>}
        <label>Banner (any size)<input type="file" accept="image/*" onChange={(e) => setBn(e.target.files[0] || null)} /></label>
        {me.banner && <button type="button" className="more" onClick={() => remove('banner')}>Remove banner</button>}
        <label>Bio<textarea rows={3} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
        <button className="btn btn-primary btn-compact" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </Dialog>
  );
}

const Stat = ({ v, l, to }) => { const inner = <><b>{v}</b><span>{l}</span></>; return to ? <Link className="stat" to={to}>{inner}</Link> : <div className="stat">{inner}</div>; };
const Section = ({ title, to, linkLabel = 'View all', children }) => <section className="pf-sec"><div className="sec-head"><h2 className="row-title">{title}</h2>{to && <Link className="more" to={to}>{linkLabel}</Link>}</div>{children}</section>;

export default function Profile() {
  const { handle } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  const toast = useToast();
  const r = useAsync(() => api(`/users/${encodeURIComponent(handle)}`), [handle]);
  const watch = useAsync(() => api(`/lists/watchlist?user=${encodeURIComponent(handle)}&limit=12`), [handle]);
  const later = useAsync(() => api(`/lists/later?user=${encodeURIComponent(handle)}&limit=12`), [handle]);
  const reviews = useAsync(() => api(`/reviews?user=${encodeURIComponent(handle)}&limit=5`), [handle]);
  const p = r.data;
  useTitle(p?.user.username);

  if (handle === 'me') return <Navigate to={`/u/${user.username}`} replace />;
  if (r.loading) return <main className="app-main"><div className="wrap"><div className="row-status"><p>Loading profile…</p></div></div></main>;
  if (r.error) return <main className="app-main"><div className="wrap"><div className="row-status"><p>{r.error.status === 404 ? 'That user does not exist.' : r.error.message}</p><Link className="btn btn-ghost btn-compact" to="/people">Find friends</Link></div></div></main>;

  const u = p.user, base = `/u/${u.username}`;
  const me = p.isMe ? { ...u, ...user } : u;
  const grid = (items, pct) => items.length ? <ul className="poster-grid">{items.map((i) => <PosterCard key={i.tvId} item={{ id: i.tvId, name: i.name, poster_path: i.posterPath, pct: pct && i.seasons ? Math.min(100, ((i.loggedSeasons || 0) / i.seasons) * 100) : null, meta: pct ? [`${i.loggedSeasons || 0} of ${i.seasons || '?'} seasons`] : [] }} />)}</ul> : <div className="row-status"><p>Nothing here yet.</p></div>;
  const copy = async () => { try { await navigator.clipboard.writeText(u.bid); toast('Brambo ID copied.'); } catch { toast(u.bid); } };

  return (
    <main className="app-main nopad"><div className="wrap">
      <div className="banner" style={me.banner ? { backgroundImage: `url(${me.banner})` } : undefined} />
      <div className="pf-head">
        <Avatar user={me} size="xl" alt={`${u.username} profile picture`} />
        <div className="info">
          <h1>{u.username}</h1>
          <button type="button" className="bid-chip" onClick={copy} title="Copy Brambo ID"><span>Brambo ID</span> <b>{u.bid}</b></button>
          <p>{u.bio || (p.isMe ? 'Add a short bio so friends know your taste.' : 'No bio yet.')}</p>
          <p className="follow-line"><Link to={`${base}/followers`}><b>{u.followersCount}</b> follower{u.followersCount === 1 ? '' : 's'}</Link><Link to={`${base}/following`}><b>{u.followingCount}</b> following</Link><span className="muted">Joined {fmtDate(u.createdAt, { month: 'short', year: 'numeric' })}</span></p>
        </div>
        {p.isMe ? <button className="btn btn-ghost btn-compact" type="button" onClick={() => setEdit(true)}>Edit profile</button>
          : <FollowButton handle={u.username} following={p.isFollowing} onChange={() => r.reload()} />}
      </div>

      <div className="stats">
        <Stat v={fmtTime(p.stats.minutes)} l="Total time spent" />
        <Stat v={p.stats.seasons} l="Seasons logged" to={`${base}/diary`} />
        <Stat v={p.stats.episodes} l="Episodes watched" />
      </div>
      <div className="stats small">
        <Stat v={p.stats.shows} l="Shows watched" />
        <Stat v={p.stats.favourites} l="Favourites" to={`${base}/list/favourites`} />
        <Stat v={p.stats.reviews} l="Reviews" />
      </div>

      <Section title="Diary" to={`${base}/diary`} linkLabel="Open full diary">
        {p.recent.length ? (
          <ul className="d-list compact">{p.recent.map((e) => (
            <li className="d-row" key={e._id}>
              <span className="d-date">{fmtDate(e.watchedOn, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <Link to={`/series/${e.tvId}`} className="d-poster">{e.posterPath && <img src={img(e.posterPath, 'w154')} alt="" loading="lazy" />}</Link>
              <div className="d-main"><Link to={`/series/${e.tvId}`} className="d-title">{e.name}</Link><span className="d-season">Season {e.season}</span></div>
              {e.rating ? <Popcorn value={e.rating} size={16} label="Season rating" /> : <span />}
            </li>))}
          </ul>
        ) : <div className="row-status"><p>{p.isMe ? 'Your diary is empty. Open a series and log a season you have watched.' : 'No seasons logged yet.'}</p></div>}
        {p.recent.length > 0 && <button type="button" className="btn btn-ghost btn-compact diary-open" onClick={() => nav(`${base}/diary`)}>View all {p.stats.seasons} logs</button>}
      </Section>

      <Section title="Favourites" to={`${base}/list/favourites`}>{grid(p.favourites.map((f) => f))}</Section>
      <Section title="Watch list" to={`${base}/list/watchlist`}>{watch.loading ? <div className="row-status"><p>Loading…</p></div> : grid(watch.data?.items || [], true)}</Section>
      <Section title="Watch later" to={`${base}/list/later`}>{later.loading ? <div className="row-status"><p>Loading…</p></div> : grid(later.data?.items || [])}</Section>
      <Section title="Reviews" to="/reviews" linkLabel={p.isMe ? 'All reviews' : undefined}>
        {reviews.data?.items?.length ? <div className="rv-list">{reviews.data.items.map((x) => <ReviewCard key={x._id} r={x} />)}</div> : <div className="row-status"><p>No reviews yet.</p></div>}
      </Section>
      {p.isMe && <EditDialog open={edit} onClose={() => setEdit(false)} me={me} onSaved={() => r.reload()} />}
    </div></main>
  );
}
