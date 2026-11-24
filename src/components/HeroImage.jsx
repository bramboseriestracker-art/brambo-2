import { useEffect, useState } from 'react';
import { img, shuffle } from '../lib/api.js';

/* Rotating backdrop built from a pool of TMDB series. */
export default function HeroImage({ pool }) {
  const [list] = useState(() => shuffle(pool.filter((s) => s.backdrop_path)));
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const cur = list[i % Math.max(1, list.length)];
  useEffect(() => { if (list.length > 1) { const t = setInterval(() => { setReady(false); setI((n) => n + 1); }, 10000); return () => clearInterval(t); } }, [list.length]);
  if (!cur) return null;
  return (
    <div className="hero-media">
      <img className={'hero-image' + (ready ? ' is-ready' : '')} src={img(cur.backdrop_path, 'w1280')} alt="" onLoad={() => setReady(true)} />
      <div className="hero-shade" /><div className="hero-glow" />
    </div>
  );
}
