import { useState } from 'react';
import { Link } from 'react-router-dom';
import { img, fmtDate } from '../lib/api.js';
import Popcorn from './Popcorn.jsx';
import Avatar from './Avatar.jsx';

/* r: { name, tvId?, posterPath?, poster_path?, rating, text, by: {username, avatar}|string, createdAt } */
export default function ReviewCard({ r, onDelete, showSeries = true }) {
  const [open, setOpen] = useState(false);
  const poster = r.posterPath || r.poster_path;
  const by = typeof r.by === 'string' ? { username: r.by } : r.by;
  const long = r.text.length > 240;
  const body = (
    <>
      {showSeries && <h3>{r.tvId ? <Link to={`/series/${r.tvId}`}>{r.name}</Link> : r.name}</h3>}
      <p className="by">
        {by && <>{by.id ? <Link to={`/u/${by.username}`} className="by-link"><Avatar user={by} size="xs" /> {by.username}</Link> : <span>{by.username}</span>}</>}
        {r.rating ? <Popcorn value={r.rating} size={16} showValue label="Review rating" /> : null}
        {r.createdAt && <span className="muted">{fmtDate(r.createdAt)}</span>}
      </p>
      <p className={'t' + (open ? ' open' : '')}>{r.text}</p>
      {long && <button type="button" className="more" onClick={() => setOpen((v) => !v)}>{open ? 'Show less' : 'Read more'}</button>}
      {onDelete && <button type="button" className="more danger" onClick={onDelete}>Delete</button>}
    </>
  );
  return (
    <article className="rv">
      {showSeries && poster ? <img src={img(poster, 'w154')} alt="" loading="lazy" /> : null}
      <div>{body}</div>
    </article>
  );
}
