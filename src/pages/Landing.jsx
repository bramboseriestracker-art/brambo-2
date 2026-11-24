import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { tmdb, img, shuffle, iso, daysFrom } from '../lib/api.js';
import { useAsync, useTitle } from '../lib/hooks.js';
import { useShows } from '../lib/shows.js';
import { Row } from '../components/Carousel.jsx';
import HeroImage from '../components/HeroImage.jsx';
import Footer from '../components/Footer.jsx';
import Brand from '../components/Brand.jsx';
import { PopcornMini } from '../components/Popcorn.jsx';
import '../styles/landing.css';

const NOISE = '10763,10767';
const stream = { watch_region: 'IN', with_watch_monetization_types: 'flatrate', without_genres: NOISE };
const discover = (p) => tmdb('discover/tv', { sort_by: 'popularity.desc', include_adult: 'false', ...p });
const TAGS = ['ALL IN ONE PLACE', 'ONE SEARCH', 'ONE WATCHLIST', 'CRITICALLY ACCLAIMED', 'HIGHEST RATED', 'MUST WATCH SERIES'];

function Feature() {
  const { data } = useAsync(async () => {
    const page = 1 + ((Math.random() * 4) | 0);
    const d = await tmdb('discover/tv', { without_genres: NOISE, sort_by: 'vote_average.desc', 'vote_count.gte': 1000, page });
    return shuffle(d.results).filter((s) => s.poster_path && s.overview).slice(0, 6);
  }, []);
  const [p, setP] = useState(0);
  if (!data?.length) return null;
  const view = data.slice(p * 3, p * 3 + 3);
  const flip = () => setP((n) => (n ? 0 : 1));
  return (
    <section className="series-row top-rated-feature-row">
      <div className="feature-slider-wrapper">
        {data.length > 3 && <button type="button" className="feature-nav-arrow feature-nav-prev" aria-label="Previous" onClick={flip}>‹</button>}
        <div className="feature-cards-grid">
          {view.map((s, i) => (
            <Link key={s.id} to="/auth?mode=signup" className="feature-card">
              <div className="feature-poster-wrapper"><div className="feature-poster-frame"><img className="feature-poster-img" src={img(s.poster_path)} alt={s.name} /></div><div className="feature-badge-pill"><PopcornMini value={s.vote_average} label="TMDB rating" /></div></div>
              <div className="feature-tagline-caps">{TAGS[(p * 3 + i) % TAGS.length]}</div>
              <h3 className="feature-show-title">{s.name}</h3>
              <p className="feature-show-overview">{s.overview}</p>
            </Link>
          ))}
        </div>
        {data.length > 3 && <button type="button" className="feature-nav-arrow feature-nav-next" aria-label="Next" onClick={flip}>›</button>}
      </div>
    </section>
  );
}

export default function Landing() {
  useTitle('');
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const pool = useAsync(async () => (await Promise.all(shuffle([1, 2, 3, 4, 5, 6]).map((p) => tmdb('tv/popular', { page: p })))).flatMap((x) => x.results), []);
  const popular = useShows(() => discover({ ...stream, 'vote_count.gte': 50 }), [], { limit: 12, mix: true });
  const fresh = useShows(() => discover({ ...stream, 'first_air_date.gte': iso(daysFrom(-180)), 'first_air_date.lte': iso(new Date()) }), [], { limit: 12, mix: true });
  const netflix = useShows(() => discover({ ...stream, with_watch_providers: 8 }), [], { limit: 12, mix: true });
  const hbo = useShows(() => discover({ with_networks: '49|3186', without_genres: NOISE, 'vote_count.gte': 50 }), [], { limit: 12, mix: true });
  const more = useShows(() => discover({ ...stream, 'vote_count.gte': 200, page: 2 }), [], { limit: 24, mix: true });
  useEffect(() => { document.body.classList.add('landing'); return () => document.body.classList.remove('landing'); }, []);
  const failed = [popular, fresh].every((r) => r.error);

  if (ready && user) return <Navigate to="/home" replace />;
  return (
    <>
      <a href="#discover" className="skip-link">Skip to main content</a>
      <header className="site-header">
        <div className="wrap header-inner">
          <Brand to="/" />
          <button type="button" className="menu-toggle" aria-expanded={open} aria-label="Toggle navigation menu" onClick={() => setOpen((v) => !v)}><span className="menu-bars" /></button>
          <div className={'site-menu' + (open ? ' is-open' : '')}>
            <nav className="site-nav" aria-label="Main"><ul className="nav-list"><li><a href="#discover">Discover</a></li><li><a href="#how">How it works</a></li><li><a href="#about">About</a></li></ul></nav>
            <div className="auth-actions"><Link className="btn btn-quiet" to="/auth?mode=login">Log in</Link><Link className="btn btn-primary" to="/auth?mode=signup">Sign up</Link></div>
          </div>
        </div>
      </header>

      <section className="hero">
        {pool.data && <HeroImage pool={pool.data} />}
        <div className="wrap hero-inner"><div className="hero-copy">
          <h1 className="hero-title"><span>TRACK WHAT YOU WATCH.</span><span>DISCOVER WHAT'S NEXT.</span></h1>
          <p className="hero-text">Log every season in your diary, rate episodes with popcorn, follow friends and find your next series.</p>
          <div className="hero-actions"><a href="#discover" className="btn btn-primary btn-large">Start exploring</a><button type="button" className="btn btn-ghost btn-large" onClick={() => nav('/auth?mode=signup')}>Create watchlist</button></div>
        </div></div>
      </section>

      <main className="discover" id="discover">
        <div className="wrap">
          {failed && <div className="setup-notice" role="alert"><h2>Series data is unavailable</h2><p>The TMDB connection is not configured or is down. Set <code>TMDB_API_KEY</code> in your Vercel environment variables.</p></div>}
          <Feature />
          <Row id="popular" title="Popular TV series" sub="Trending series currently watched worldwide" {...popular} />
          <Row id="new" title="New releases" sub="Series premiered in the last 6 months" {...fresh} />
          <Row id="netflix" title="Popular on Netflix" sub="Top streaming shows available on Netflix" {...netflix} />
          <Row id="hbo" title="HBO originals" sub="Flagship HBO and HBO Max series" {...hbo} />
          <Row id="more" title="More to explore" sub="Hidden gems and fan favourites" {...more} />
        </div>
      </main>

      <section className="how" id="how"><div className="wrap">
        <h2 className="section-title">How Brambo works</h2>
        <p className="section-sub">Tracking built for people who watch series season by season.</p>
        <div className="steps">
          <div className="step" data-step="blue"><span className="step-node">1</span><h3>Find shows</h3><p>Search live data across the major streaming networks and release schedules.</p></div>
          <div className="step" data-step="violet"><span className="step-node">2</span><h3>Log seasons</h3><p>Record each season with the date you watched it and build a diary others can browse.</p></div>
          <div className="step" data-step="pink"><span className="step-node">3</span><h3>Rate and share</h3><p>Rate episodes in popcorn, follow friends with their Brambo ID and see what they watch.</p></div>
        </div>
      </div></section>

      <section className="about" id="about"><div className="wrap about-grid">
        <div><h2 className="section-title">Built for serious binge watchers</h2></div>
        <div className="about-copy">
          <p>Brambo shows episode, season and series ratings in one place, so you can see where a show peaks and where it drops.</p>
          <p>Series data comes live from TMDB. Your diary, lists, ratings and friends are stored in your Brambo account.</p>
        </div>
      </div></section>

      <section className="cta"><div className="wrap cta-inner">
        <div className="cta-copy"><h2 className="cta-title">Ready to start tracking your next favourite series?</h2><p>Create a free account and start your watch diary.</p></div>
        <div><Link to="/auth?mode=signup" className="btn btn-light btn-large">Get started free</Link></div>
      </div></section>
      <Footer guest />
    </>
  );
}
