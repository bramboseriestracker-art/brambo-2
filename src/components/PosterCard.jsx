import { Link } from 'react-router-dom';
import { img } from '../lib/api.js';
import { PopcornMini } from './Popcorn.jsx';

/* item: { id, name, poster_path, rank?, pct?, meta?: string[], to? } */
export default function PosterCard({ item, to }) {
  return (
    <li>
      <Link className="poster-card" to={to || item.to || `/series/${item.id}`}>
        <span className="poster-frame">
          {item.poster_path ? <img src={img(item.poster_path)} alt="" loading="lazy" decoding="async" /> : <span className="poster-missing">{item.name}</span>}
          {item.rank ? <span className="rank">{item.rank}</span> : null}
        </span>
        <span className="poster-title">{item.name}</span>
        {item.pct != null && <span className="poster-progress"><span style={{ width: `${item.pct}%` }} /></span>}
        {item.rating > 0 && <span className="poster-rating"><PopcornMini value={item.rating} /></span>}
        {(item.meta || []).map((m, i) => <span className="poster-rating" key={i}>{m}</span>)}
      </Link>
    </li>
  );
}

export function Skeleton({ count = 6 }) {
  return (
    <ul className="poster-grid skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <li key={i}><div className="poster-frame" /><div className="skeleton-line" /><div className="skeleton-line" /></li>)}
    </ul>
  );
}
