import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tmdb, img, fmtDate } from '../lib/api.js';
import { useAsync, useTitle } from '../lib/hooks.js';
import PosterCard from '../components/PosterCard.jsx';
import '../styles/series.css';

const dedupe = (list) => { const seen = new Set(); return list.filter((c) => c.media_type === 'tv' && c.poster_path && !seen.has(c.id) && seen.add(c.id)); };

export default function Person() {
  const { id } = useParams();
  const { data: p, loading, error } = useAsync(() => tmdb(`person/${id}`, { append_to_response: 'combined_credits' }), [id]);
  const [more, setMore] = useState(false);
  useTitle(p?.name);

  const shows = useMemo(() => dedupe([...(p?.combined_credits?.cast || [])].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))), [p]);
  const crew = useMemo(() => dedupe([...(p?.combined_credits?.crew || [])].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))), [p]);
  const crewJobs = useMemo(() => { const m = {}; (p?.combined_credits?.crew || []).forEach((c) => { if (c.media_type === 'tv') (m[c.id] ||= new Set()).add(c.job); }); return m; }, [p]);

  if (loading) return <main className="app-main"><div className="wrap"><div className="row-status"><p>Loading…</p></div></div></main>;
  if (error) return <main className="app-main"><div className="wrap"><div className="row-status"><p>Could not load this person.</p><Link className="btn btn-ghost btn-compact" to="/home">Back to home</Link></div></div></main>;

  const bio = p.biography || '';
  const age = p.birthday ? Math.floor(((p.deathday ? new Date(p.deathday) : new Date()) - new Date(p.birthday)) / 31557600000) : null;
  const facts = [['Known for', p.known_for_department], ['Born', p.birthday && `${fmtDate(p.birthday)}${age != null && !p.deathday ? ` (age ${age})` : ''}`], ['Died', p.deathday && fmtDate(p.deathday)], ['Birthplace', p.place_of_birth]].filter((f) => f[1]);

  return (
    <main className="app-main"><div className="wrap">
      <div className="person-top">
        {p.profile_path ? <img className="person-photo" src={img(p.profile_path, 'w342')} alt={p.name} /> : <div className="person-photo person-photo--none">{p.name[0]}</div>}
        <div>
          <h1 className="page-title">{p.name}</h1>
          <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {bio ? <><p className={'bio' + (more ? ' open' : '')}>{bio}</p>{bio.length > 500 && <button type="button" className="more" onClick={() => setMore((v) => !v)}>{more ? 'Show less' : 'Read more'}</button>}</> : <p className="muted">No biography available.</p>}
        </div>
      </div>
      <section className="s-sec"><h2 className="row-title">Shows</h2>
        {shows.length ? <ul className="poster-grid">{shows.map((s) => <PosterCard key={s.id} item={{ id: s.id, name: s.name, poster_path: s.poster_path, meta: [s.character || (s.episode_count ? `${s.episode_count} episodes` : '')].filter(Boolean) }} />)}</ul> : <div className="row-status"><p>No series credits found.</p></div>}
      </section>
      {crew.length > 0 && <section className="s-sec"><h2 className="row-title">Behind the camera</h2>
        <ul className="poster-grid">{crew.slice(0, 24).map((s) => <PosterCard key={s.id} item={{ id: s.id, name: s.name, poster_path: s.poster_path, meta: [[...(crewJobs[s.id] || [])].slice(0, 2).join(', ')] }} />)}</ul></section>}
    </div></main>
  );
}
