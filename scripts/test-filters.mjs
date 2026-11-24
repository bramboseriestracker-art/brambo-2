/* Tests every "Sort by" checkbox on Editor's choice against a simulated TMDB catalogue (no network needed). */
import { GENRES, COUNTRIES, COLLECTIONS, buildParams, discover } from '../src/lib/discover.js';

let failed = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) failed++; };

/* Simulated catalogue: Indian and recently released series have few votes, like the real data. */
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const today = new Date();
const catalogue = [];
const genreIds = Object.values(GENRES), countryCodes = Object.values(COUNTRIES);
for (let i = 1; i <= 1500; i++) {
  const c = countryCodes[i % countryCodes.length];
  const recent = i % 9 === 0;
  const d = new Date(today); d.setDate(d.getDate() - (recent ? Math.floor(rnd() * 150) : 200 + Math.floor(rnd() * 4000)));
  catalogue.push({ id: i, name: `Show ${i}`, poster_path: `/p${i}.jpg`, origin_country: [c], genre_ids: [genreIds[i % genreIds.length], genreIds[(i * 3) % genreIds.length]],
    vote_count: c === 'IN' ? Math.floor(rnd() * 160) : recent ? Math.floor(rnd() * 90) : Math.floor(rnd() * 9000),
    vote_average: 5 + rnd() * 4.6, popularity: rnd() * 500, first_air_date: d.toISOString().slice(0, 10) });
}

function fakeTmdb(params, page) {
  let l = catalogue.filter((s) => s.vote_count >= Number(params['vote_count.gte'] || 0));
  if (params['vote_average.gte']) l = l.filter((s) => s.vote_average >= Number(params['vote_average.gte']));
  if (params.with_origin_country) l = l.filter((s) => params.with_origin_country.split('|').includes(s.origin_country[0]));
  if (params.with_genres) l = l.filter((s) => s.genre_ids.some((g) => params.with_genres.split('|').includes(String(g))));
  if (params['first_air_date.gte']) l = l.filter((s) => s.first_air_date >= params['first_air_date.gte'] && s.first_air_date <= params['first_air_date.lte']);
  const key = params.sort_by.startsWith('popularity') ? 'popularity' : 'vote_average';
  l = [...l].sort((a, b) => b[key] - a[key]);
  return Promise.resolve({ results: l.slice((page - 1) * 20, page * 20) });
}

const run = (applied) => discover(applied, fakeTmdb);
const empty = { c: [], g: [], n: [] };

ok((await run(empty)).length >= 12, 'no filters: results returned');

for (const [label, v] of Object.entries(COLLECTIONS)) {
  const r = await run({ ...empty, c: [v] });
  ok(r.length > 0, `Collection "${label}" returns results (${r.length})`);
}
for (const [label, v] of Object.entries(GENRES)) {
  const r = await run({ ...empty, g: [String(v)] });
  ok(r.length > 0 && r.every((s) => s.genre_ids.includes(v)), `Genre "${label}" returns only that genre (${r.length})`);
}
for (const [label, v] of Object.entries(COUNTRIES)) {
  const r = await run({ ...empty, n: [v] });
  ok(r.length > 0 && r.every((s) => s.origin_country[0] === v), `Country "${label}" returns only ${v} series (${r.length})`);
}

/* The reported bug: India returned nothing because the old fixed threshold was 1000 votes. */
const old = await fakeTmdb({ ...buildParams({ ...empty, n: ['IN'] }, 1000) }, 1);
ok(old.results.length === 0, 'reproduced the old bug: India at a fixed 1000-vote threshold gives 0 results');
ok((await run({ ...empty, n: ['IN'] })).length >= 12, 'India now returns a full list');

/* Combinations */
ok((await run({ c: ['top10'], g: [], n: ['IN'] })).length > 0, 'Top 10 + India');
ok((await run({ c: ['new'], g: [], n: ['KR'] })).length > 0, 'Newly released + South Korea');
ok((await run({ c: ['new', 'fans'], g: [], n: [] })).length > 0, 'Newly released + Fan favourites (previously conflicted)');
ok((await run({ c: ['acclaimed'], g: ['18'], n: ['IN', 'GB'] })).length > 0, 'Acclaimed + Drama + India/UK');
ok((await run({ c: [], g: ['35', '80'], n: [] })).length > 0, 'Two genres at once (Comedy or Crime)');
const p = buildParams({ c: ['new'], g: [], n: [] }, 30, new Date('2026-11-22'));
ok(p['first_air_date.gte'] === '2026-05-26' && p['first_air_date.lte'] === '2026-11-22', 'Newly released window is the last 180 days');

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
