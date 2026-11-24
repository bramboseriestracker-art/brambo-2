import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, tmdb, tmdbSeasons, img, snap, avg, fmtDate } from '../lib/api.js';
import { useAsync, useTitle } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { toItems } from '../lib/shows.js';
import Popcorn from '../components/Popcorn.jsx';
import Collapse from '../components/Collapse.jsx';
import { Carousel } from '../components/Carousel.jsx';
import LogDialog from '../components/LogDialog.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import '../styles/series.css';

const rated = (e) => e.vote_count > 0 && e.vote_average > 0;
const seasonScore = (s) => avg((s?.episodes || []).filter(rated).map((e) => e.vote_average));

const GENERIC = /^(season|series|episode|ep)\s*\d+(\.\d+)?$/i;

function Episode({ e, selected, onSelect, ratings, onRate }) {
  const key = `${e.season_number}-${e.episode_number}`;
  const community = ratings?.episodes?.[key];
  const mine = ratings?.mine?.[key] || 0;
  const unaired = e.air_date && new Date(e.air_date) > new Date();
  const title = e.name && !GENERIC.test(e.name.trim()) ? e.name : '';
  return (
    <li className={'ep' + (selected ? ' is-open' : '')}>
      <button type="button" className="ep-head" aria-expanded={selected} onClick={onSelect}>
        <span className="ep-num">{e.episode_number}</span>
        <span className="ep-title">Episode {e.episode_number}<small>{[title, unaired ? `Airs ${fmtDate(e.air_date)}` : fmtDate(e.air_date)].filter(Boolean).join('  |  ')}</small></span>
        <span className="ep-score">{rated(e) ? <Popcorn value={e.vote_average} size={15} label="Episode rating" /> : <span className="muted">Not rated</span>}</span>
      </button>
      <Collapse open={selected}>
        <div className="ep-body">
          {e.still_path && <img src={img(e.still_path, 'w300')} alt="" loading="lazy" />}
          <div className="ep-info">
            {title && <h4 className="ep-name">{title}</h4>}
            <p>{e.overview || 'No description available for this episode.'}</p>
            <p className="ep-meta">{[e.runtime && `${e.runtime} min`, e.air_date && fmtDate(e.air_date)].filter(Boolean).join('  |  ')}</p>
            <div className="ep-rates">
              <div><span className="lab">TMDB's rating</span>{rated(e) ? <Popcorn value={e.vote_average} size={22} label="TMDB rating" /> : <span className="muted">No votes yet</span>}</div>
              <div><span className="lab">Brambo's rating{community ? ` (${community.count})` : ''}</span>{community ? <Popcorn value={community.avg} size={22} label="Brambo rating" /> : <span className="muted">Not rated yet</span>}</div>
              <div><span className="lab">Your rating</span><Popcorn value={mine} size={26} onChange={(v) => onRate(e, v)} label="Your rating" /></div>
            </div>
          </div>
        </div>
      </Collapse>
    </li>
  );
}

function Season({ s, data, open, onToggle, logs, onLog, ratings, onRate, selected, setSelected }) {
  const score = seasonScore(data);
  const log = logs[0];
  const custom = s.name && !GENERIC.test(s.name.trim()) && !/^specials?$/i.test(s.name.trim()) ? s.name : '';
  return (
    <section className={'season' + (open ? ' is-open' : '')}>
      <button type="button" className="season-head" aria-expanded={open} onClick={onToggle}>
        <span className="season-name">Season {s.season_number}<small>{[s.air_date?.slice(0, 4), `${s.episode_count} episodes`, custom].filter(Boolean).join('  |  ')}</small></span>
        {log && <span className="chip">Watched {fmtDate(log.watchedOn)}</span>}
        <span className="season-score">{data ? (score ? <Popcorn value={score} size={18} label="Season rating" /> : <span className="muted">Not rated</span>) : <span className="muted">…</span>}</span>
        <span className="chev" aria-hidden="true" />
      </button>
      <Collapse open={open}>
        <div className="season-body">
          {s.overview && <p className="season-overview">{s.overview}</p>}
          <div className="season-actions">
            <button type="button" className="btn btn-ghost btn-compact" onClick={() => onLog(s.season_number)}>{log ? 'Log again' : 'Log this season'}</button>
            {score > 0 && <span className="muted">Season rating is the average of its episode ratings.</span>}
          </div>
          {!data ? <p className="muted">Loading episodes…</p> : (
            <ul className="eps">{data.episodes.map((e) => {
              const k = `${e.season_number}-${e.episode_number}`;
              return <Episode key={k} e={e} selected={selected === k} onSelect={() => setSelected(selected === k ? null : k)} ratings={ratings} onRate={onRate} />;
            })}</ul>
          )}
        </div>
      </Collapse>
    </section>
  );
}

function Cast({ cast }) {
  const [all, setAll] = useState(false);
  const list = all ? cast.slice(0, 60) : cast.slice(0, 14);
  if (!cast.length) return null;
  return (
    <section className="s-sec"><h2 className="row-title">Cast</h2>
      <ul className="cast-grid">{list.map((c) => (
        <li key={c.id}><Link to={`/person/${c.id}`} className="cast-card">
          <span className="cast-photo">{c.profile_path ? <img src={img(c.profile_path, 'w185')} alt="" loading="lazy" /> : <span>{c.name[0]}</span>}</span>
          <span className="cast-name">{c.name}</span>
          <span className="cast-role">{c.roles?.[0]?.character || 'Cast'}</span>
        </Link></li>))}
      </ul>
      {cast.length > 14 && <button type="button" className="btn btn-ghost btn-compact" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${Math.min(cast.length, 60)}`}</button>}
    </section>
  );
}

function ReviewBox({ t, reviews, onSaved, myRating, onRate }) {
  const { user } = useAuth();
  const toast = useToast();
  const mine = reviews.find((r) => r.user === user.id);
  const rating = myRating;
  const setRating = onRate;
  const [text, setText] = useState(mine?.text || '');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!rating) return toast('Give the series a popcorn rating first.');
    setBusy(true);
    try { await api('/reviews', { method: 'POST', body: { ...snap(t), rating, text } }); toast('Review saved.'); onSaved(); } catch (x) { toast(x.message); } finally { setBusy(false); }
  };
  const del = async () => { try { await api(`/reviews/${mine._id}`, { method: 'DELETE' }); setText(''); toast('Review deleted.'); onSaved(); } catch (x) { toast(x.message); } };
  return (
    <section className="s-sec"><h2 className="row-title">Reviews</h2>
      <form className="review-form" onSubmit={save}>
        <div className="rate-line"><span>{mine ? 'Your review' : 'Rate and review'}</span><Popcorn value={rating} onChange={setRating} size={28} label="Your rating" /></div>
        <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you think?" aria-label="Review" required minLength={3} />
        <div className="review-actions"><button className="btn btn-primary btn-compact" disabled={busy}>{mine ? 'Update review' : 'Post review'}</button>{mine && <button type="button" className="btn btn-ghost btn-compact" onClick={del}>Delete</button>}</div>
      </form>
      <div className="rv-list">{reviews.filter((r) => r.user !== user.id || false).map((r) => <ReviewCard key={r._id} r={r} showSeries={false} />)}</div>
      {!reviews.length && <p className="muted">No reviews yet.</p>}
    </section>
  );
}

export default function Series() {
  const { id } = useParams();
  const toast = useToast();
  const [openSeason, setOpenSeason] = useState(null);
  const [selected, setSelected] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logSeason, setLogSeason] = useState(null);

  const main = useAsync(() => tmdb(`tv/${id}`, { append_to_response: 'aggregate_credits,recommendations,similar,content_ratings' }), [id]);
  const t = main.data;
  const seasonList = useMemo(() => (t?.seasons || []).filter((s) => s.season_number > 0 && s.episode_count > 0), [t]);
  const sdata = useAsync(() => (t ? tmdbSeasons(id, seasonList.map((s) => s.season_number)) : {}), [t]);
  const ratings = useAsync(() => api(`/ratings/${id}`), [id]);
  const status = useAsync(() => api(`/lists/status/${id}`), [id]);
  const diary = useAsync(() => api(`/diary/show/${id}`), [id]);
  const reviews = useAsync(() => api(`/reviews?tvId=${id}&limit=30`), [id]);
  const sRating = useAsync(() => api(`/series-ratings/${id}`), [id]);
  useTitle(t?.name);

  const logsBySeason = useMemo(() => { const m = {}; (diary.data?.items || []).forEach((l) => (m[l.season] ||= []).push(l)); return m; }, [diary.data]);
  const allEps = useMemo(() => Object.values(sdata.data || {}).flatMap((s) => s.episodes || []), [sdata.data]);
  const tmdbScore = t?.vote_count > 0 ? t.vote_average : avg(allEps.filter(rated).map((e) => e.vote_average));
  const sr = sRating.data || { avg: 0, count: 0, mine: 0 };
  const runtime = t?.episode_run_time?.[0] || allEps.find((e) => e.runtime)?.runtime || 45;

  const toggleList = async (list) => {
    const on = status.data?.[list];
    status.setData((s) => ({ ...s, [list]: !on }));
    try { await api(`/lists/${list}/${id}`, { method: on ? 'DELETE' : 'PUT', body: on ? undefined : snap(t) }); }
    catch (e) { status.setData((s) => ({ ...s, [list]: on })); toast(e.message); }
  };
  const rateSeries = async (v) => {
    const prev = sRating.data;
    sRating.setData((r) => ({ ...r, mine: v }));
    try { sRating.setData(await api(`/series-ratings/${id}`, { method: 'PUT', body: { rating: v } })); }
    catch (x) { sRating.setData(prev); toast(x.message); }
  };
  const rateEpisode = async (e, v) => {
    const key = `${e.season_number}-${e.episode_number}`;
    const prev = ratings.data;
    ratings.setData((r) => ({ ...r, mine: { ...r.mine, [key]: v } }));
    try { await api(`/ratings/${id}/${e.season_number}/${e.episode_number}`, { method: 'PUT', body: { rating: v } }); ratings.reload(); }
    catch (x) { ratings.setData(prev); toast(x.message); }
  };

  if (main.loading) return <main className="app-main"><div className="wrap"><div className="row-status"><p>Loading series…</p></div></div></main>;
  if (main.error) return <main className="app-main"><div className="wrap"><div className="row-status"><p>{main.error.status === 404 ? 'This series could not be found.' : 'Could not load this series. Try again shortly.'}</p><Link className="btn btn-ghost btn-compact" to="/home">Back to home</Link></div></div></main>;

  const cert = t.content_ratings?.results?.find((c) => c.iso_3166_1 === 'US' || c.iso_3166_1 === 'IN')?.rating;
  const recs = toItems((t.recommendations?.results?.length ? t.recommendations : t.similar)?.results, { limit: 18 });
  const lists = [['watchlist', 'Watch list'], ['later', 'Watch later'], ['favourites', 'Favourite']];

  return (
    <main className="series-page">
      <section className="s-hero">
        {t.backdrop_path && <img className="s-backdrop" src={img(t.backdrop_path, 'w1280')} alt="" />}
        <div className="s-shade" />
        <div className="wrap s-top">
          {t.poster_path ? <img className="s-poster" src={img(t.poster_path, 'w500')} alt={`${t.name} poster`} /> : <div className="s-poster s-poster--none">{t.name}</div>}
          <div className="s-main">
            <h1>{t.name}</h1>
            <p className="s-meta">{[`${(t.first_air_date || '').slice(0, 4)}${t.status === 'Ended' && t.last_air_date ? '–' + t.last_air_date.slice(0, 4) : t.status === 'Returning Series' ? '–' : ''}`, cert, `${t.number_of_seasons} season${t.number_of_seasons === 1 ? '' : 's'}`, `${t.number_of_episodes} episodes`, t.status].filter(Boolean).join('  |  ')}</p>
            {t.genres?.length > 0 && <ul className="chips">{t.genres.map((g) => <li key={g.id}>{g.name}</li>)}</ul>}
            <div className="rating-trio">
              <div className="rating-box mine">
                <span className="lab">Your rating</span>
                <Popcorn value={sr.mine} size={26} onChange={rateSeries} label="Your rating" />
                <small>{sr.mine ? <>You rated this series. <button type="button" className="link-btn" onClick={() => rateSeries(0)}>Clear</button></> : 'Click the popcorn to rate'}</small>
              </div>
              <div className="rating-box">
                <span className="lab">Brambo's rating</span>
                {sr.count ? <Popcorn value={sr.avg} size={26} label="Brambo rating" /> : <span className="muted">No ratings yet</span>}
                <small>{sr.count ? `Average of ${sr.count} Brambo rating${sr.count === 1 ? '' : 's'}` : 'Be the first to rate'}</small>
              </div>
              <div className="rating-box">
                <span className="lab">TMDB's rating</span>
                {tmdbScore ? <Popcorn value={tmdbScore} size={26} label="TMDB rating" /> : <span className="muted">No votes yet</span>}
                <small>{t.vote_count ? `${t.vote_count.toLocaleString()} votes on TMDB` : 'From TMDB'}</small>
              </div>
            </div>
            {t.tagline && <p className="s-tag">{t.tagline}</p>}
            <p className="s-overview">{t.overview || 'No description available.'}</p>
            <div className="s-actions">
              <button type="button" className="btn btn-primary btn-compact" onClick={() => { setLogSeason(null); setLogOpen(true); }} disabled={!seasonList.length}>Log a season</button>
              {lists.map(([k, label]) => <button key={k} type="button" className="btn btn-ghost btn-compact" aria-pressed={!!status.data?.[k]} onClick={() => toggleList(k)} disabled={!status.data}>{status.data?.[k] ? `${label}: added` : label}</button>)}
            </div>
          </div>
        </div>
      </section>

      <div className="wrap s-body">
        <section className="s-sec"><h2 className="row-title">Seasons</h2>
          <p className="muted s-hint">Open a season to see its rating and episodes. Select an episode for its description and ratings.</p>
          <div className="seasons">
            {seasonList.map((s) => (
              <Season key={s.id} s={s} data={sdata.data?.[s.season_number]} open={openSeason === s.season_number}
                onToggle={() => { setOpenSeason(openSeason === s.season_number ? null : s.season_number); setSelected(null); }}
                logs={logsBySeason[s.season_number] || []} onLog={(n) => { setLogSeason(n); setLogOpen(true); }}
                ratings={ratings.data} onRate={rateEpisode} selected={selected} setSelected={setSelected} />
            ))}
            {sdata.error && <p className="muted">Episode ratings could not be loaded.</p>}
          </div>
        </section>

        <Cast cast={t.aggregate_credits?.cast || []} />

        <ReviewBox t={t} reviews={reviews.data?.items || []} onSaved={() => { reviews.reload(); sRating.reload(); }} key={reviews.data ? 'r' : 'n'} myRating={sr.mine} onRate={rateSeries} />

        {recs.length > 0 && <section className="s-sec"><h2 className="row-title">More like this</h2><Carousel items={recs} /></section>}
      </div>

      <LogDialog open={logOpen} onClose={() => setLogOpen(false)} show={snap(t)} seasons={seasonList} initialSeason={logSeason} runtime={runtime} onLogged={() => { diary.reload(); status.reload(); }} />
    </main>
  );
}
