import { Router } from 'express';
import express from 'express';
import { User, Follow, Media, DiaryEntry, ListItem, Review, SeriesRating, EpisodeRating } from './models.js';
import { wrap, HttpError, requireAuth, optionalAuth, publicUser, miniUser, resolveUser, normalizeBid, esc, page, str } from './util.js';

const router = Router();

/* Search by Brambo ID (exact) or username (prefix). */
router.get('/users/search', requireAuth, wrap(async (req, res) => {
  const raw = String(req.query.q || '').trim();
  const term = raw.replace(/^@/, '');
  if (term.length < 1) return res.json({ users: [] });
  const bid = normalizeBid(raw);
  /* Anchored prefix match on the unique usernameLower index: fast from the first character. */
  const filter = { role: { $ne: 'admin' }, ...(bid ? { bid } : { usernameLower: { $regex: '^' + esc(term.toLowerCase()) } }) };
  const users = await User.find(filter).sort({ followersCount: -1, usernameLower: 1 }).limit(20);
  const ids = users.map((u) => u._id);
  const mine = new Set((await Follow.find({ follower: req.uid, following: { $in: ids } }).select('following')).map((f) => String(f.following)));
  res.json({ users: users.map((u) => ({ ...publicUser(u), isFollowing: mine.has(String(u._id)), isMe: String(u._id) === String(req.uid) })) });
}));

/* Most active members (last 30 days), topped up with popular and new members so the list is never empty. */
router.get('/users/active', requireAuth, wrap(async (req, res) => {
  const since = new Date(Date.now() - 30 * 864e5);
  const count = (M) => M.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]);
  const [diary, reviews, sRatings, eRatings] = await Promise.all([count(DiaryEntry), count(Review), count(SeriesRating), count(EpisodeRating)]);
  const act = new Map();
  const add = (rows, key) => rows.forEach((r) => { const k = String(r._id); const a = act.get(k) || { logs: 0, reviews: 0, ratings: 0 }; a[key] += r.n; act.set(k, a); });
  add(diary, 'logs'); add(reviews, 'reviews'); add(sRatings, 'ratings'); add(eRatings, 'ratings');
  const score = (a) => a.logs * 3 + a.reviews * 2 + a.ratings;
  const ranked = [...act.entries()].filter(([id]) => id !== String(req.uid)).sort((a, b) => score(b[1]) - score(a[1])).slice(0, 40).map(([id]) => id);

  const base = { role: { $ne: 'admin' }, _id: { $ne: req.uid } };
  const byId = new Map((await User.find({ ...base, _id: { $in: ranked } })).map((u) => [String(u._id), u]));
  let list = ranked.map((id) => byId.get(id)).filter(Boolean).slice(0, 20);
  if (list.length < 12) {
    const have = list.map((u) => u._id);
    const extra = await User.find({ ...base, _id: { $nin: [...have, req.uid] } }).sort({ followersCount: -1, createdAt: -1 }).limit(12 - list.length);
    list = [...list, ...extra];
  }
  const mine = new Set((await Follow.find({ follower: req.uid, following: { $in: list.map((u) => u._id) } }).select('following')).map((f) => String(f.following)));
  res.json({ users: list.map((u) => ({ ...publicUser(u), isFollowing: mine.has(String(u._id)), isMe: false, activity: act.get(String(u._id)) || { logs: 0, reviews: 0, ratings: 0 } })) });
}));

/* Public profile with stats and previews. */
router.get('/users/:handle', optionalAuth, wrap(async (req, res) => {
  const u = await resolveUser(req.params.handle, req);
  const [agg, recent, favourites, counts, reviews, rel] = await Promise.all([
    DiaryEntry.aggregate([
      { $match: { user: u._id } },
      { $group: { _id: null, logs: { $sum: 1 }, episodes: { $sum: '$episodeCount' }, minutes: { $sum: { $multiply: ['$episodeCount', '$runtime'] } }, shows: { $addToSet: '$tvId' } } },
      { $project: { _id: 0, logs: 1, episodes: 1, minutes: 1, shows: { $size: '$shows' } } }
    ]),
    DiaryEntry.find({ user: u._id }).sort({ watchedOn: -1, createdAt: -1 }).limit(6),
    ListItem.find({ user: u._id, list: 'favourites' }).sort({ createdAt: -1 }).limit(12),
    ListItem.aggregate([{ $match: { user: u._id } }, { $group: { _id: '$list', n: { $sum: 1 } } }]),
    Review.countDocuments({ user: u._id }),
    req.uid && String(req.uid) !== String(u._id) ? Follow.exists({ follower: req.uid, following: u._id }) : null
  ]);
  const c = Object.fromEntries(counts.map((x) => [x._id, x.n]));
  res.json({
    user: publicUser(u),
    isMe: !!req.uid && String(req.uid) === String(u._id),
    isFollowing: !!rel,
    stats: { seasons: agg[0]?.logs || 0, episodes: agg[0]?.episodes || 0, minutes: agg[0]?.minutes || 0, shows: agg[0]?.shows || 0, reviews, favourites: c.favourites || 0, watchlist: c.watchlist || 0, later: c.later || 0 },
    recent,
    favourites
  });
}));

/* Follow / unfollow */
router.post('/users/:handle/follow', requireAuth, wrap(async (req, res) => {
  const target = await resolveUser(req.params.handle, req);
  if (String(target._id) === String(req.uid)) throw new HttpError(400, 'You cannot follow yourself.');
  const r = await Follow.updateOne({ follower: req.uid, following: target._id }, { $setOnInsert: { follower: req.uid, following: target._id } }, { upsert: true });
  if (r.upsertedCount) {
    await Promise.all([User.updateOne({ _id: req.uid }, { $inc: { followingCount: 1 } }), User.updateOne({ _id: target._id }, { $inc: { followersCount: 1 } })]);
  }
  const fresh = await User.findById(target._id).select('followersCount');
  res.json({ isFollowing: true, followersCount: fresh.followersCount });
}));

router.delete('/users/:handle/follow', requireAuth, wrap(async (req, res) => {
  const target = await resolveUser(req.params.handle, req);
  const r = await Follow.deleteOne({ follower: req.uid, following: target._id });
  if (r.deletedCount) {
    await Promise.all([
      User.updateOne({ _id: req.uid, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
      User.updateOne({ _id: target._id, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } })
    ]);
  }
  const fresh = await User.findById(target._id).select('followersCount');
  res.json({ isFollowing: false, followersCount: fresh.followersCount });
}));

/* Followers / following lists */
async function connections(req, res, dir) {
  const u = await resolveUser(req.params.handle, req);
  const { page: p, limit, skip } = page(req.query, 30, 60);
  const key = dir === 'followers' ? 'follower' : 'following';
  const where = dir === 'followers' ? { following: u._id } : { follower: u._id };
  const [rows, total] = await Promise.all([Follow.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(key), Follow.countDocuments(where)]);
  const people = rows.map((r) => r[key]).filter(Boolean);
  const ids = people.map((x) => x._id);
  const mine = req.uid ? new Set((await Follow.find({ follower: req.uid, following: { $in: ids } }).select('following')).map((f) => String(f.following))) : new Set();
  res.json({
    owner: miniUser(u),
    total, page: p, pages: Math.max(1, Math.ceil(total / limit)),
    users: people.map((x) => ({ ...publicUser(x), isFollowing: mine.has(String(x._id)), isMe: !!req.uid && String(x._id) === String(req.uid) }))
  });
}
router.get('/users/:handle/followers', optionalAuth, wrap((req, res) => connections(req, res, 'followers')));
router.get('/users/:handle/following', optionalAuth, wrap((req, res) => connections(req, res, 'following')));

/* Edit own profile */
router.put('/me/profile', requireAuth, wrap(async (req, res) => {
  const bio = req.body?.bio == null ? '' : str(req.body.bio, 160, { field: 'Bio' });
  const u = await User.findByIdAndUpdate(req.uid, { bio }, { new: true });
  res.json({ user: publicUser(u, { self: true }) });
}));

/* Profile images: resized client-side, stored as binary, served with long cache. */
const MAX_BYTES = 2 * 1024 * 1024; // the browser compresses any upload to fit; Vercel limits request bodies to 4.5 MB
router.put('/me/media/:kind', requireAuth, express.json({ limit: '3.2mb' }), wrap(async (req, res) => {
  const kind = req.params.kind;
  if (!['avatar', 'banner'].includes(kind)) throw new HttpError(400, 'Unknown image type.');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl || '');
  if (!m) throw new HttpError(400, 'Upload a JPEG, PNG or WebP image.');
  const data = Buffer.from(m[2], 'base64');
  if (!data.length || data.length > MAX_BYTES) throw new HttpError(413, 'Image is too large after compression. Try a different image.');
  await Media.updateOne({ user: req.uid, kind }, { $set: { contentType: m[1], data } }, { upsert: true });
  const ver = Date.now();
  const u = await User.findByIdAndUpdate(req.uid, { [kind === 'avatar' ? 'avatarVer' : 'bannerVer']: ver }, { new: true });
  res.json({ user: publicUser(u, { self: true }) });
}));

router.delete('/me/media/:kind', requireAuth, wrap(async (req, res) => {
  const kind = req.params.kind;
  if (!['avatar', 'banner'].includes(kind)) throw new HttpError(400, 'Unknown image type.');
  await Media.deleteOne({ user: req.uid, kind });
  const u = await User.findByIdAndUpdate(req.uid, { [kind === 'avatar' ? 'avatarVer' : 'bannerVer']: 0 }, { new: true });
  res.json({ user: publicUser(u, { self: true }) });
}));

router.get('/media/:userId/:kind', wrap(async (req, res) => {
  if (!['avatar', 'banner'].includes(req.params.kind) || !/^[a-f\d]{24}$/i.test(req.params.userId)) throw new HttpError(404, 'Not found.');
  const m = await Media.findOne({ user: req.params.userId, kind: req.params.kind });
  if (!m) throw new HttpError(404, 'Not found.');
  res.setHeader('Content-Type', m.contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(m.data);
}));

export default router;
