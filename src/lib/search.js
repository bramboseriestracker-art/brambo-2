import { tmdb } from './api.js';

/* Local title index: popular and top-rated series are loaded once so matches appear instantly,
   from the very first keystroke. Live TMDB results are merged in as they arrive. */
let indexPromise;
export function loadIndex() {
  if (!indexPromise) {
    indexPromise = Promise.allSettled([
      ...[1, 2, 3, 4].map((page) => tmdb('tv/popular', { page })),
      ...[1, 2, 3].map((page) => tmdb('tv/top_rated', { page })),
      tmdb('trending/tv/week')
    ]).then((rs) => {
      const map = new Map();
      rs.forEach((r) => r.status === 'fulfilled' && r.value.results.forEach((s) => {
        if (s.poster_path && !map.has(s.id)) map.set(s.id, { id: s.id, name: s.name, poster_path: s.poster_path, year: (s.first_air_date || '').slice(0, 4), pop: s.popularity || 0 });
      }));
      return [...map.values()];
    });
  }
  return indexPromise;
}

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* 0 exact, 1 starts with, 2 a word starts with, 3 contains, 9 no match */
export function matchScore(name, q) {
  const n = norm(name);
  if (!q) return 9;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(' ').some((w) => w.startsWith(q))) return 2;
  return n.includes(q) ? 3 : 9;
}

export function rankLocal(index, q, limit = 8) {
  return index.map((s) => ({ s, m: matchScore(s.name, q) })).filter((x) => x.m < 9).sort((a, b) => a.m - b.m || b.s.pop - a.s.pop).slice(0, limit).map((x) => x.s);
}

/* Merge local matches with live TMDB results, best match first. */
export function merge(local, live, q, limit = 8) {
  const map = new Map(local.map((s) => [s.id, s]));
  (live || []).forEach((s) => {
    if (s.poster_path && !map.has(s.id)) map.set(s.id, { id: s.id, name: s.name, poster_path: s.poster_path, year: (s.first_air_date || '').slice(0, 4), pop: s.popularity || 0 });
  });
  return [...map.values()].map((s) => ({ s, m: matchScore(s.name, q) })).sort((a, b) => a.m - b.m || b.s.pop - a.s.pop).slice(0, limit).map((x) => x.s);
}
