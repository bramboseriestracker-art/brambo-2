/* Editor's choice: translates the "Sort by" checkboxes into TMDB discover/tv parameters.
   Pure functions so every option can be tested without the network. */
export const GENRES = { 'Action & Adventure': 10759, Animation: 16, Comedy: 35, Crime: 80, Documentary: 99, Drama: 18, Family: 10751, Mystery: 9648, 'Sci-Fi & Fantasy': 10765, 'War & Politics': 10768 };
export const COUNTRIES = { 'United States': 'US', 'United Kingdom': 'GB', India: 'IN', 'South Korea': 'KR', Japan: 'JP', France: 'FR', Germany: 'DE', Spain: 'ES', Canada: 'CA', Australia: 'AU', Turkey: 'TR', Brazil: 'BR' };
export const COLLECTIONS = { 'Top 10': 'top10', 'Newly released': 'new', 'Critically acclaimed': 'acclaimed', 'Fan favourites': 'fans' };

/* Minimum vote counts to try, strictest first. Regional and new shows have far fewer votes
   (many Indian series have under 100), so the search relaxes step by step until results appear. */
export const VOTE_STEPS = [1000, 300, 100, 30, 10, 3];

export function startStep(c, n) {
  if (c.includes('new')) return 3;      // new releases rarely have many votes
  if (n.length) return 2;               // country filters: start at 100
  return 0;
}

export function buildParams({ c, g, n }, minVotes, today = new Date()) {
  const p = { sort_by: 'vote_average.desc', 'vote_count.gte': minVotes, without_genres: '10763,10767', include_adult: 'false' };
  if (c.includes('new')) {
    const from = new Date(today); from.setDate(from.getDate() - 180);
    p['first_air_date.gte'] = from.toISOString().slice(0, 10);
    p['first_air_date.lte'] = today.toISOString().slice(0, 10);
  }
  if (c.includes('acclaimed')) p['vote_average.gte'] = 8.2;
  if (c.includes('fans')) p.sort_by = 'popularity.desc';
  if (g.length) p.with_genres = g.join('|');
  if (n.length) p.with_origin_country = n.join('|');
  return p;
}

/* Runs the query, relaxing the vote threshold until enough results exist. `fetchPage(params, page)` returns TMDB JSON. */
export async function discover(applied, fetchPage, want = 12) {
  const { c, g, n } = applied;
  let best = [];
  for (let i = startStep(c, n); i < VOTE_STEPS.length; i++) {
    const params = buildParams(applied, VOTE_STEPS[i]);
    const pages = await Promise.all([1, 2].map((page) => fetchPage(params, page).catch(() => ({ results: [] }))));
    const seen = new Set();
    const list = pages.flatMap((p) => p.results || []).filter((s) => s.poster_path && s.name && !seen.has(s.id) && seen.add(s.id));
    if (list.length > best.length) best = list;
    if (list.length >= want) break;
  }
  return best;
}
