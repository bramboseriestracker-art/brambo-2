import { useRef } from 'react';
import PosterCard, { Skeleton } from './PosterCard.jsx';

export function Carousel({ items }) {
  const ref = useRef(null);
  const go = (d) => ref.current?.scrollBy({ left: d * 600, behavior: 'smooth' });
  return (
    <div className="poster-carousel">
      <button type="button" className="carousel-arrow carousel-prev" aria-label="Scroll left" onClick={() => go(-1)}>‹</button>
      <ul className="poster-grid" ref={ref}>{items.map((it, i) => <PosterCard key={`${it.id}-${i}`} item={it} />)}</ul>
      <button type="button" className="carousel-arrow carousel-next" aria-label="Scroll right" onClick={() => go(1)}>›</button>
    </div>
  );
}

export const matches = (items, q) => (q ? items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase())) : items);

/* state: { loading, error, items }; hides itself when a filter has no matches. */
export function Row({ id, title, sub, items, loading, error, empty, q = '', grid = false }) {
  const list = matches(items || [], q);
  if (q && !loading && !list.length) return null;
  return (
    <section className="series-row" data-row={id}>
      <header className="row-head"><h2 className="row-title">{title}</h2>{sub && <p className="row-sub">{sub}</p>}</header>
      {loading ? <Skeleton /> : error ? <div className="row-status"><p>{error}</p></div>
        : list.length ? (grid ? <ul className="poster-grid">{list.map((it) => <PosterCard key={it.id} item={it} />)}</ul> : <Carousel items={list} />)
        : <div className="row-status"><p>{empty || 'Nothing here yet.'}</p></div>}
    </section>
  );
}

export function FilterBar({ value, onChange, placeholder = 'Filter series by title' }) {
  return (
    <div className="filter-bar">
      <input type="search" className="filter-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoComplete="off" />
    </div>
  );
}
