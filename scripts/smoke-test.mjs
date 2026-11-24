/* End-to-end API check. Run the API first (`npm run api`), then: node scripts/smoke-test.mjs [baseUrl] */
const BASE = process.argv[2] || 'http://localhost:5000';
let failed = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) failed++; };

function client() {
  let cookie = '';
  return async (path, method = 'GET', body) => {
    const r = await fetch(BASE + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {}
    return { s: r.status, j, h: r.headers };
  };
}
const sfx = Math.random().toString(36).slice(2, 8);
const A = client(), B = client();
const TV = 1000000 + Math.floor(Math.random() * 900000); // fresh series id each run keeps the test repeatable
const snap = { tvId: TV, name: 'Game of Thrones', posterPath: '/poster.jpg', backdropPath: '/back.jpg', seasons: 8 };

let r = await A('/auth/signup', 'POST', { username: `alice_${sfx}`, email: `a_${sfx}@x.io`, password: 'password123' });
ok(r.s === 201 && /^BR-[A-Z0-9]{8}$/.test(r.j.user.bid), 'signup issues a Brambo ID ' + r.j.user?.bid);
const aBid = r.j.user.bid;
r = await A('/auth/signup', 'POST', { username: `alice_${sfx}`, email: `z_${sfx}@x.io`, password: 'password123' });
ok(r.s === 409, 'duplicate username rejected');
r = await B('/auth/signup', 'POST', { username: `bob_${sfx}`, email: `b_${sfx}@x.io`, password: 'password123' });
ok(r.s === 201, 'second user signup');
r = await A('/auth/me'); ok(r.s === 200 && r.j.user.username === `alice_${sfx}`, 'session cookie works');
r = await (client())('/auth/me'); ok(r.s === 401, 'no cookie -> 401');
r = await (client())('/auth/login', 'POST', { identifier: `alice_${sfx}`, password: 'wrong-password' }); ok(r.s === 401, 'bad password -> 401');

r = await B(`/users/search?q=${aBid}`); ok(r.j.users?.length === 1 && r.j.users[0].username === `alice_${sfx}`, 'search by BID');
r = await B(`/users/search?q=alice_${sfx.slice(0, 3)}`); ok(r.j.users?.some((u) => u.bid === aBid), 'search by username prefix');

r = await B(`/users/${aBid}/follow`, 'POST'); ok(r.s === 200 && r.j.followersCount === 1, 'follow by BID');
r = await B(`/users/${aBid}/follow`, 'POST'); ok(r.j.followersCount === 1, 'follow is idempotent');
r = await B(`/users/bob_${sfx}/follow`, 'POST'); ok(r.s === 400, 'cannot follow yourself');
r = await A(`/users/bob_${sfx}`); ok(r.j.user.followingCount === 1 && r.j.isFollowing === false, 'profile counts');
r = await A(`/users/me`); ok(r.j.user.followersCount === 1 && r.j.isMe, 'own profile: followers=1');
r = await A(`/users/${aBid}/followers`); ok(r.j.total === 1 && r.j.users[0].username === `bob_${sfx}`, 'followers list');

r = await A('/diary', 'POST', { ...snap, season: 1, episodeCount: 10, runtime: 60, watchedOn: '2026-03-02', rating: 9, note: 'great' }); ok(r.s === 201, 'log season 1');
r = await A('/diary', 'POST', { ...snap, season: 2, episodeCount: 10, runtime: 60, watchedOn: '2026-04-11' }); ok(r.s === 201, 'log season 2');
r = await A('/diary', 'POST', { ...snap, season: 3, episodeCount: 10, runtime: 60, watchedOn: '2099-01-01' }); ok(r.s === 400, 'future date rejected');
r = await A('/diary?user=me'); ok(r.j.total === 2 && r.j.items[0].season === 2, 'diary sorted by watched date');
r = await B(`/diary?user=${aBid}`); ok(r.j.total === 2, 'diary is public by BID');
r = await B(`/users/${aBid}`); ok(r.j.stats.seasons === 2 && r.j.stats.episodes === 20 && r.j.stats.minutes === 1200 && r.j.stats.shows === 1, 'stats aggregate (time = episodes x runtime)');
r = await A(`/lists/status/${TV}`); ok(r.j.watchlist === true, 'logging adds series to watch list');
r = await B('/feed'); ok(r.j.items.length === 2 && r.j.items[0].by.username === `alice_${sfx}`, 'friends feed shows followed user logs');
r = await A('/lists/watchlist'); ok(r.j.items[0].loggedSeasons === 2 && r.j.items[0].nextSeason === 3, 'watch list progress');

r = await A(`/lists/favourites/${TV}`, 'PUT', snap); ok(r.s === 200, 'add favourite');
r = await A(`/lists/later/${TV}`, 'PUT', snap); r = await A(`/lists/status/${TV}`); ok(r.j.favourites && r.j.later, 'list status');
r = await A(`/lists/later/${TV}`, 'DELETE'); r = await A(`/lists/status/${TV}`); ok(!r.j.later, 'remove from watch later');
r = await A(`/lists/bogus/${TV}`, 'PUT', snap); ok(r.s === 400, 'unknown list rejected');

r = await A(`/ratings/${TV}/1/1`, 'PUT', { rating: 9 }); ok(r.s === 200, 'rate episode');
r = await B(`/ratings/${TV}/1/1`, 'PUT', { rating: 5 });
r = await A(`/ratings/${TV}`); ok(r.j.episodes['1-1'].avg === 7 && r.j.episodes['1-1'].count === 2 && r.j.mine['1-1'] === 9, 'community avg + own rating');
r = await A(`/ratings/${TV}/1/1`, 'PUT', { rating: 11 }); ok(r.s === 400, 'rating range enforced');
r = await B(`/ratings/${TV}/1/1`, 'PUT', { rating: 0 }); r = await A(`/ratings/${TV}`); ok(r.j.episodes['1-1'].count === 1, 'clear rating');

r = await A('/reviews', 'POST', { ...snap, rating: 9, text: 'Superb.' }); ok(r.s === 201, 'post review');
r = await A('/reviews', 'POST', { ...snap, rating: 8, text: 'Superb, revised.' });
r = await A(`/reviews?tvId=${TV}`); ok(r.j.total === 1 && r.j.items[0].rating === 8 && r.j.items[0].by.username === `alice_${sfx}`, 'one review per user, upsert');

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
r = await A('/me/media/avatar', 'PUT', { dataUrl: png }); ok(r.s === 200 && r.j.user.avatar, 'upload avatar');
const img = await fetch(BASE + r.j.user.avatar); ok(img.status === 200 && img.headers.get('content-type') === 'image/png', 'avatar is served');
const big = 'data:image/jpeg;base64,' + Buffer.alloc(1300 * 1024, 7).toString('base64');
r = await A('/me/media/banner', 'PUT', { dataUrl: big }); ok(r.s === 200, 'large (1.3 MB) banner upload is accepted');
const huge = 'data:image/jpeg;base64,' + Buffer.alloc(2600 * 1024, 7).toString('base64');
r = await A('/me/media/banner', 'PUT', { dataUrl: huge }); ok(r.s === 413, 'upload over the server cap is refused with a clear error');
r = await A('/me/media/avatar', 'PUT', { dataUrl: 'data:text/html;base64,PGI+' }); ok(r.s === 400, 'non-image upload rejected');
r = await A('/me/profile', 'PUT', { bio: 'x'.repeat(200) }); ok(r.s === 400, 'bio length enforced');
r = await A('/me/profile', 'PUT', { bio: 'Binge watcher' }); ok(r.j.user.bio === 'Binge watcher', 'update bio');

r = await B(`/users/${aBid}/follow`, 'DELETE'); ok(r.j.followersCount === 0 && r.j.isFollowing === false, 'unfollow');
r = await B('/feed'); ok(r.j.items.length === 0, 'feed empties after unfollow');
r = await B(`/diary/${(await A('/diary')).j.items[0]._id}`, 'DELETE'); ok(r.s === 404, "cannot delete someone else's diary entry");
r = await A(`/diary/${(await A('/diary')).j.items[0]._id}`, 'DELETE'); ok(r.s === 200, 'delete own entry');
r = await A('/auth/logout', 'POST'); r = await A('/auth/me'); ok(r.s === 401, 'logout clears session');

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
