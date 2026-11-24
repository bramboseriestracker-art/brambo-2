import { useEffect, useRef, useState } from 'react';
import { tmdb } from '../lib/api.js';
import { GENRES, COUNTRIES, COLLECTIONS as COLL, discover } from '../lib/discover.js';
import { useTitle, useClickOutside } from '../lib/hooks.js';
import { toItems } from '../lib/shows.js';
import PosterCard, { Skeleton } from '../components/PosterCard.jsx';
import { FilterBar, matches } from '../components/Carousel.jsx';

const EMPTY = { c: [], g: [], n: [] };

function Group({ legend, map, values, onToggle }) {
  return (
    <fieldset><legend>{legend}</legend>
      <div className="checks">{Object.entries(map).map(([k, v]) => <label key={k}><input type="checkbox" checked={values.includes(String(v))} onChange={() => onToggle(String(v))} />{k}</label>)}</div>
    </fieldset>
  );
}

export default function Editors() {
  useTitle("Editor's choice");
  const [applied, setApplied] = useState(EMPTY);
  const [draft, setDraft] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ loading: true, items: [], error: false });
  const [q, setQ] = useState('');
  const pop = useRef(null);
  useClickOutside(pop, () => setOpen(false));
  const toggle = (k) => (v) => setDraft((d) => ({ ...d, [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] }));

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    discover(applied, (params, page) => tmdb('discover/tv', { ...params, page }))
      .then((results) => {
        if (!live) return;
        const all = toItems(results, { limit: 40 });
        const top = applied.c.includes('top10');
        setState({ loading: false, error: false, items: top ? all.slice(0, 10).map((s, i) => ({ ...s, rank: i + 1 })) : all.slice(0, 30) });
      })
      .catch(() => live && setState({ loading: false, error: true, items: [] }));
    return () => { live = false; };
  }, [applied]);

  const filters = applied.c.length + applied.g.length + applied.n.length;
  const list = matches(state.items, q);
  return (
    <main className="app-main"><div className="wrap">
      <div className="bar">
        <div><h1 className="page-title">Editor's choice</h1><p className="page-sub">{state.loading ? 'Loading…' : `${state.items.length} series${filters ? ' match your filters' : ' rated highest by viewers'}`}</p></div>
        <div className="sortby" ref={pop}>
          <button type="button" className="btn btn-ghost btn-compact" aria-expanded={open} onClick={() => { setDraft(applied); setOpen((v) => !v); }}>Sort by</button>
          {open && (
            <form className="pop" onSubmit={(e) => { e.preventDefault(); setApplied(draft); setOpen(false); }}>
              <Group legend="Collections" map={COLL} values={draft.c} onToggle={toggle('c')} />
              <Group legend="Genres" map={GENRES} values={draft.g} onToggle={toggle('g')} />
              <Group legend="Countries" map={COUNTRIES} values={draft.n} onToggle={toggle('n')} />
              <div className="pop-actions"><button type="button" className="btn btn-ghost btn-compact" onClick={() => { setDraft(EMPTY); setApplied(EMPTY); setOpen(false); }}>Clear</button><button type="submit" className="btn btn-primary btn-compact">Apply</button></div>
            </form>
          )}
        </div>
      </div>
      <FilterBar value={q} onChange={setQ} placeholder="Filter these results by title" />
      {state.loading ? <Skeleton count={12} /> : state.error ? <div className="row-status"><p>Could not load series. Try again shortly.</p></div>
        : list.length ? <ul className="poster-grid">{list.map((s) => <PosterCard key={s.id} item={s} />)}</ul> : <div className="row-status"><p>No series match. Clear a filter and retry.</p></div>}
    </div></main>
  );
}
