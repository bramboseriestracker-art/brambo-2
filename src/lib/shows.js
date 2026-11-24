import { useMemo } from 'react';
import { useAsync } from './hooks.js';
import { shuffle } from './api.js';

/* Map TMDB results into poster-card items. */
export const toItems = (results, { limit = 18, meta, mix = false } = {}) => {
  const seen = new Set();
  let list = (results || []).filter((s) => s && s.poster_path && s.name && !seen.has(s.id) && seen.add(s.id));
  if (mix) list = shuffle(list);
  return list.slice(0, limit).map((s) => ({ id: s.id, name: s.name, poster_path: s.poster_path, rating: s.vote_count > 0 ? s.vote_average : 0, meta: meta ? meta(s) : [] }));
};

/* Load a TMDB list into card items. */
export function useShows(fetcher, deps, opts) {
  const a = useAsync(async () => toItems((await fetcher()).results, opts), deps);
  return useMemo(() => ({ items: a.data || [], loading: a.loading, error: a.error ? 'Could not load series. Try again shortly.' : null }), [a.data, a.loading, a.error]);
}
