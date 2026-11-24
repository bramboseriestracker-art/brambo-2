import { Router } from 'express';
import { User, Follow, ListItem, DiaryEntry, Review, EpisodeRating, SeriesRating } from './models.js';
import { wrap, HttpError, requireAuth, optionalAuth, resolveUser, snapshot, int, str, page, miniUser, isStr } from './util.js';

const router = Router();
const LISTS = ['watchlist', 'later', 'favourites'];
const MAX_LIST = 2000;
const listName = (v) => { if (!LISTS.includes(v)) throw new HttpError(400, 'Unknown list.'); return v; };

/* ======================= Lists ======================= */
router.get('/lists/status/:tvId', requireAuth, wrap(async (req, res) => {
  const tvId = int(req.params.tvId, 1, 1e9, 'Series id');
  const rows = await ListItem.find({ user: req.uid, tvId }).select('list');
  const has = new Set(rows.map((r) => r.list));
  res.json({ watchlist: has.has('watchlist'), later: has.has('later'), favourites: has.has('favourites') });
}));

router.get('/lists/:list', optionalAuth, wrap(async (req, res) => {
  const list = listName(req.params.list);
  const u = await resolveUser(req.query.user || 'me', req);
  const { page: p, limit, skip } = page(req.query, 48, 100);
  const [items, total] = await Promise.all([
    ListItem.find({ user: u._id, list }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ListItem.countDocuments({ user: u._id, list })
  ]);
  if (list === 'watchlist' && items.length) {
    const logged = await DiaryEntry.aggregate([
      { $match: { user: u._id, tvId: { $in: items.map((i) => i.tvId) } } },
      { $group: { _id: '$tvId', seasons: { $addToSet: '$season' }, last: { $max: '$watchedOn' } } }
    ]);
    const map = new Map(logged.map((l) => [l._id, l]));
    items.forEach((i) => {
      const l = map.get(i.tvId);
      i.loggedSeasons = l ? l.seasons.length : 0;
      i.nextSeason = l ? Math.max(...l.seasons) + 1 : 1;
      i.lastLogged = l ? l.last : null;
    });
  }
  res.json({ owner: miniUser(u), items, total, page: p, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.put('/lists/:list/:tvId', requireAuth, wrap(async (req, res) => {
  const list = listName(req.params.list);
  const s = snapshot({ ...req.body, tvId: req.params.tvId });
  if (await ListItem.countDocuments({ user: req.uid, list }) >= MAX_LIST) throw new HttpError(400, 'This list is full.');
  await ListItem.updateOne({ user: req.uid, list, tvId: s.tvId }, { $set: s, $setOnInsert: { user: req.uid, list } }, { upsert: true });
  res.json({ ok: true, list, in: true });
}));

router.delete('/lists/:list/:tvId', requireAuth, wrap(async (req, res) => {
  await ListItem.deleteOne({ user: req.uid, list: listName(req.params.list), tvId: int(req.params.tvId, 1, 1e9, 'Series id') });
  res.json({ ok: true, in: false });
}));

/* ======================= Diary ======================= */
const parseDate = (v) => {
  if (!isStr(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, 'Enter the date you watched it.');
  const d = new Date(v + 'T00:00:00.000Z');
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Enter a valid date.');
  if (d.getTime() > Date.now() + 36 * 3600e3) throw new HttpError(400, 'The watched date cannot be in the future.');
  if (d.getUTCFullYear() < 1950) throw new HttpError(400, 'Enter a more recent date.');
  return d;
};
const optRating = (v) => (v == null || v === '' || v === 0 ? undefined : int(v, 1, 10, 'Rating'));

router.get('/diary', optionalAuth, wrap(async (req, res) => {
  const u = await resolveUser(req.query.user || 'me', req);
  const { page: p, limit, skip } = page(req.query, 50, 100);
  const [items, total] = await Promise.all([
    DiaryEntry.find({ user: u._id }).sort({ watchedOn: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    DiaryEntry.countDocuments({ user: u._id })
  ]);
  res.json({ owner: miniUser(u), items, total, page: p, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.get('/diary/show/:tvId', requireAuth, wrap(async (req, res) => {
  const items = await DiaryEntry.find({ user: req.uid, tvId: int(req.params.tvId, 1, 1e9, 'Series id') }).sort({ season: 1, watchedOn: -1 }).lean();
  res.json({ items });
}));

router.post('/diary', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const s = snapshot(b);
  const entry = await DiaryEntry.create({
    user: req.uid, ...s,
    season: int(b.season, 1, 200, 'Season'),
    episodeCount: int(b.episodeCount, 1, 1000, 'Episode count'),
    runtime: b.runtime == null ? 45 : int(b.runtime, 1, 600, 'Runtime'),
    watchedOn: parseDate(b.watchedOn),
    rating: optRating(b.rating),
    note: b.note ? str(b.note, 500, { field: 'Note' }) : '',
    rewatch: !!b.rewatch
  });
  /* Logging a season moves the series from "later" into the watchlist. */
  await Promise.all([
    ListItem.deleteOne({ user: req.uid, list: 'later', tvId: s.tvId }),
    ListItem.updateOne({ user: req.uid, list: 'watchlist', tvId: s.tvId }, { $setOnInsert: { user: req.uid, list: 'watchlist', ...s } }, { upsert: true })
  ]);
  res.status(201).json({ entry });
}));

router.patch('/diary/:id', requireAuth, wrap(async (req, res) => {
  const b = req.body || {}, set = {}, unset = {};
  if (b.watchedOn !== undefined) set.watchedOn = parseDate(b.watchedOn);
  if (b.note !== undefined) set.note = b.note ? str(b.note, 500, { field: 'Note' }) : '';
  if (b.rating !== undefined) { const r = optRating(b.rating); if (r) set.rating = r; else unset.rating = ''; }
  if (b.rewatch !== undefined) set.rewatch = !!b.rewatch;
  const update = { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) };
  const entry = await DiaryEntry.findOneAndUpdate({ _id: req.params.id, user: req.uid }, update, { new: true });
  if (!entry) throw new HttpError(404, 'Diary entry not found.');
  res.json({ entry });
}));

router.delete('/diary/:id', requireAuth, wrap(async (req, res) => {
  const r = await DiaryEntry.deleteOne({ _id: req.params.id, user: req.uid });
  if (!r.deletedCount) throw new HttpError(404, 'Diary entry not found.');
  res.json({ ok: true });
}));

/* Recent activity from people you follow. */
router.get('/feed', requireAuth, wrap(async (req, res) => {
  const ids = (await Follow.find({ follower: req.uid }).select('following').limit(500)).map((f) => f.following);
  if (!ids.length) return res.json({ items: [], following: 0 });
  const items = await DiaryEntry.find({ user: { $in: ids } }).sort({ createdAt: -1 }).limit(30).lean();
  const users = await User.find({ _id: { $in: [...new Set(items.map((i) => String(i.user)))] } }).select('username bid avatarVer');
  const map = new Map(users.map((u) => [String(u._id), miniUser(u)]));
  res.json({ following: ids.length, items: items.map((i) => ({ ...i, by: map.get(String(i.user)) })) });
}));

/* ======================= Reviews ======================= */
router.get('/reviews', optionalAuth, wrap(async (req, res) => {
  const { page: p, limit, skip } = page(req.query, 20, 50);
  const where = {};
  if (req.query.tvId) where.tvId = int(req.query.tvId, 1, 1e9, 'Series id');
  if (req.query.user) where.user = (await resolveUser(req.query.user, req))._id;
  const [rows, total] = await Promise.all([
    Review.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'username bid avatarVer').lean(),
    Review.countDocuments(where)
  ]);
  const items = rows.filter((r) => r.user).map((r) => ({ ...r, by: miniUser(r.user), user: String(r.user._id) }));
  res.json({ items, total, page: p, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.post('/reviews', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const s = snapshot(b);
  const doc = { ...s, rating: int(b.rating, 1, 10, 'Rating'), text: str(b.text, 1000, { min: 3, field: 'Review' }) };
  const review = await Review.findOneAndUpdate({ user: req.uid, tvId: s.tvId }, { $set: doc, $setOnInsert: { user: req.uid } }, { upsert: true, new: true });
  /* A review's rating is the user's overall rating for the series. */
  await SeriesRating.updateOne({ user: req.uid, tvId: s.tvId }, { $set: { rating: doc.rating } }, { upsert: true });
  res.status(201).json({ review });
}));

router.delete('/reviews/:id', requireAuth, wrap(async (req, res) => {
  const r = await Review.deleteOne({ _id: req.params.id, user: req.uid });
  if (!r.deletedCount) throw new HttpError(404, 'Review not found.');
  res.json({ ok: true });
}));

/* ======================= Overall series ratings ======================= */
router.get('/series-ratings/:tvId', optionalAuth, wrap(async (req, res) => {
  const tvId = int(req.params.tvId, 1, 1e9, 'Series id');
  const [agg, mine] = await Promise.all([
    SeriesRating.aggregate([{ $match: { tvId } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    req.uid ? SeriesRating.findOne({ user: req.uid, tvId }).select('rating').lean() : null
  ]);
  res.json({ avg: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0, count: agg[0]?.count || 0, mine: mine?.rating || 0 });
}));

router.put('/series-ratings/:tvId', requireAuth, wrap(async (req, res) => {
  const tvId = int(req.params.tvId, 1, 1e9, 'Series id');
  const value = Number(req.body?.rating);
  if (value === 0) await SeriesRating.deleteOne({ user: req.uid, tvId });
  else await SeriesRating.updateOne({ user: req.uid, tvId }, { $set: { rating: int(value, 1, 10, 'Rating') } }, { upsert: true });
  const agg = await SeriesRating.aggregate([{ $match: { tvId } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]);
  res.json({ avg: agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0, count: agg[0]?.count || 0, mine: value });
}));

/* ======================= Episode ratings ======================= */
router.get('/ratings/:tvId', optionalAuth, wrap(async (req, res) => {
  const tvId = int(req.params.tvId, 1, 1e9, 'Series id');
  const [agg, mine] = await Promise.all([
    EpisodeRating.aggregate([{ $match: { tvId } }, { $group: { _id: { s: '$season', e: '$episode' }, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    req.uid ? EpisodeRating.find({ user: req.uid, tvId }).select('season episode rating').lean() : []
  ]);
  const episodes = {};
  let sum = 0, n = 0;
  agg.forEach((a) => { episodes[`${a._id.s}-${a._id.e}`] = { avg: Math.round(a.avg * 10) / 10, count: a.count }; sum += a.avg * a.count; n += a.count; });
  res.json({ episodes, mine: Object.fromEntries(mine.map((m) => [`${m.season}-${m.episode}`, m.rating])), overall: n ? { avg: Math.round((sum / n) * 10) / 10, count: n } : null });
}));

router.put('/ratings/:tvId/:season/:episode', requireAuth, wrap(async (req, res) => {
  const key = { user: req.uid, tvId: int(req.params.tvId, 1, 1e9, 'Series id'), season: int(req.params.season, 0, 200, 'Season'), episode: int(req.params.episode, 1, 2000, 'Episode') };
  const value = Number(req.body?.rating);
  if (value === 0) { await EpisodeRating.deleteOne(key); return res.json({ ok: true, rating: 0 }); }
  const rating = int(value, 1, 10, 'Rating');
  await EpisodeRating.updateOne(key, { $set: { rating } }, { upsert: true });
  res.json({ ok: true, rating });
}));

export default router;
