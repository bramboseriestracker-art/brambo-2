import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api, tmdb, iso, daysFrom, fmtDate } from '../lib/api.js';
import { useAsync, useTitle } from '../lib/hooks.js';
import { useShows } from '../lib/shows.js';
import { Row, FilterBar } from '../components/Carousel.jsx';
import HeroImage from '../components/HeroImage.jsx';

const fromList = (items) => items.map((i) => ({ id: i.tvId, name: i.name, poster_path: i.posterPath }));

export default function Home() {
  useTitle('Home');
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const pop = useAsync(async () => (await Promise.all([1, 2].map((p) => tmdb('tv/popular', { page: p })))).flatMap((x) => x.results), []);
  const soon = useShows(() => tmdb('discover/tv', { 'first_air_date.gte': iso(daysFrom(1)), 'first_air_date.lte': iso(daysFrom(180)), sort_by: 'popularity.desc', without_genres: '10763,10767' }),
    [], { limit: 18, meta: (s) => ['Premieres ' + fmtDate(s.first_air_date, { day: 'numeric', month: 'short' })] });
  const trending = useShows(() => tmdb('trending/tv/week'), [], { limit: 18 });
  const watch = useAsync(() => api('/lists/watchlist?limit=40'), []);
  const later = useAsync(() => api('/lists/later?limit=40'), []);
  const feed = useAsync(() => api('/feed'), []);

  const cont = useMemo(() => (watch.data?.items || []).map((i) => {
    const total = i.seasons || 0;
    const done = i.loggedSeasons || 0;
    return { id: i.tvId, name: i.name, poster_path: i.posterPath, pct: total ? Math.min(100, (done / total) * 100) : 0, meta: [done ? `Next: Season ${i.nextSeason}` : 'Not started'], done: total && done >= total };
  }).filter((i) => !i.done), [watch.data]);
  const friends = useMemo(() => (feed.data?.items || []).map((e) => ({ id: `${e._id}`, name: e.name, poster_path: e.posterPath, to: `/series/${e.tvId}`, meta: [`${e.by?.username} watched S${e.season}`, fmtDate(e.watchedOn, { day: 'numeric', month: 'short' })] })), [feed.data]);

  return (
    <>
      <section className="hero hero--home">
        {pop.data && <HeroImage pool={pop.data} />}
        <div className="wrap hero-inner"><div className="hero-copy">
          {user.returning
            ? <><h1 className="hero-title"><span>WELCOME BACK, {user.username.toUpperCase()}.</span><span>PICK UP WHERE YOU LEFT OFF.</span></h1>
                <p className="hero-text">Your queue, your friends and the next premieres, in one place.</p></>
            : <><h1 className="hero-title"><span>WELCOME TO BRAMBO, {user.username.toUpperCase()}.</span><span>LET'S FIND YOUR FIRST SERIES.</span></h1>
                <p className="hero-text">Search a series, log the seasons you have watched and follow friends. Your queue will appear here.</p></>}
        </div></div>
      </section>
      <main className="discover"><div className="wrap">
        <FilterBar value={q} onChange={setQ} placeholder="Filter your rows by series title" />
        {!user.returning && <Row id="trending" title="Trending this week" sub="A good place to start. Open a series to log it or rate it" q={q} {...trending} />}
        <Row id="soon" title="Coming soon" sub="Series premiering in the next six months" q={q} {...soon} />
        <Row id="continue" title="Continue watching" sub="Your next season is one click away" q={q} items={cont} loading={watch.loading} error={watch.error && 'Could not load your watch list.'} empty="Nothing in progress. Add a series to your watch list or log a season." />
        <Row id="later" title="Watch later" sub="Series you saved for later" q={q} items={fromList(later.data?.items || [])} loading={later.loading} error={later.error && 'Could not load your list.'} empty="Your watch later list is empty. Save a series from its page." />
        <Row id="friends" title="Friends' recents" sub="What the people you follow logged lately" q={q} items={friends} loading={feed.loading} error={feed.error && 'Could not load the feed.'}
          empty={feed.data && !feed.data.following ? 'You are not following anyone yet. Find friends by username or Brambo ID.' : 'Nothing logged by your friends yet.'} />
        {user.returning && <Row id="trending" title="Trending this week" sub="What everyone is watching right now" q={q} {...trending} />}
        {feed.data && !feed.data.following && <p className="row-cta"><Link className="btn btn-ghost btn-compact" to="/people">Find friends</Link></p>}
      </div></main>
    </>
  );
}
