import { Router } from 'express';
import rateLimit from 'express-rate-limit';

/* Server-side TMDB proxy: keeps the API key private and lets Vercel's edge cache responses. */
const router = Router();
const BASE = (process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3').replace(/\/?$/, '/');
const ALLOWED = /^(tv\/\d+(\/(season\/\d+(\/episode\/\d+)?|recommendations|similar|aggregate_credits|credits|reviews))?|tv\/(popular|top_rated|on_the_air|airing_today)|search\/tv|discover\/tv|trending\/tv\/(day|week)|person\/\d+|genre\/tv\/list)$/;

router.use(rateLimit({ windowMs: 60 * 1000, limit: 240, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests.' } }));

router.get('/{*path}', async (req, res) => {
  const path = [].concat(req.params.path || []).join('/');
  if (!ALLOWED.test(path)) return res.status(400).json({ message: 'Endpoint not allowed.' });
  const key = process.env.TMDB_API_KEY || process.env.TMDB_READ_TOKEN;
  if (!key) return res.status(500).json({ message: 'TMDB is not configured on the server.' });

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(req.query)) if (k !== 'api_key' && typeof v === 'string' && v.length < 500) url.searchParams.set(k, v);
  if (!url.searchParams.has('language')) url.searchParams.set('language', 'en-US');
  const headers = { Accept: 'application/json' };
  /* A v4 read token is a long JWT; a v3 key is 32 hex characters. */
  if (key.length > 60) headers.Authorization = `Bearer ${key}`; else url.searchParams.set('api_key', key);

  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    const body = await r.text();
    res.status(r.status).type('application/json');
    if (r.ok) res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    res.send(body);
  } catch {
    res.status(504).json({ message: 'TMDB did not respond in time.' });
  }
});

export default router;
