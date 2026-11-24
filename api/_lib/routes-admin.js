import { Router } from 'express';
import { User, Follow, ListItem, DiaryEntry, Review, EpisodeRating, SeriesRating, Media, oid } from './models.js';
import { wrap, HttpError, requireAdmin, publicUser, page, esc, normalizeBid } from './util.js';

const router = Router();
router.use(requireAdmin);

const DAY = 864e5;
const members = { role: { $ne: 'admin' } };

/* ---------- overview statistics ---------- */
router.get('/overview', wrap(async (req, res) => {
  const now = Date.now();
  const d7 = new Date(now - 7 * DAY), d30 = new Date(now - 30 * DAY), d14 = new Date(now - 14 * DAY);

  const [total, verified, new7, new30, signupRows, diaryAgg, reviews, seriesRatings, episodeRatings, listRows, follows, topSeries, topRows, a1, a2, a3, a4, a5] = await Promise.all([
    User.countDocuments(members),
    User.countDocuments({ ...members, emailVerified: true }),
    User.countDocuments({ ...members, createdAt: { $gte: d7 } }),
    User.countDocuments({ ...members, createdAt: { $gte: d30 } }),
    User.aggregate([{ $match: { ...members, createdAt: { $gte: d14 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }]),
    DiaryEntry.aggregate([{ $group: { _id: null, logs: { $sum: 1 }, episodes: { $sum: '$episodeCount' }, minutes: { $sum: { $multiply: ['$episodeCount', '$runtime'] } }, shows: { $addToSet: '$tvId' } } }, { $project: { _id: 0, logs: 1, episodes: 1, minutes: 1, shows: { $size: '$shows' } } }]),
    Review.estimatedDocumentCount(),
    SeriesRating.estimatedDocumentCount(),
    EpisodeRating.estimatedDocumentCount(),
    ListItem.aggregate([{ $group: { _id: '$list', n: { $sum: 1 } } }]),
    Follow.estimatedDocumentCount(),
    DiaryEntry.aggregate([{ $group: { _id: '$tvId', name: { $first: '$name' }, posterPath: { $first: '$posterPath' }, logs: { $sum: 1 } } }, { $sort: { logs: -1 } }, { $limit: 5 }]),
    DiaryEntry.aggregate([{ $group: { _id: '$user', logs: { $sum: 1 } } }, { $sort: { logs: -1 } }, { $limit: 5 }]),
    DiaryEntry.distinct('user', { createdAt: { $gte: d7 } }),
    Review.distinct('user', { createdAt: { $gte: d7 } }),
    SeriesRating.distinct('user', { createdAt: { $gte: d7 } }),
    EpisodeRating.distinct('user', { createdAt: { $gte: d7 } }),
    ListItem.distinct('user', { createdAt: { $gte: d7 } })
  ]);

  const activeIds = [...new Set([...a1, ...a2, ...a3, ...a4, ...a5].map(String))].map(oid);
  const active7 = await User.countDocuments({ ...members, $or: [{ lastLoginAt: { $gte: d7 } }, { _id: { $in: activeIds } }] });

  const byDay = new Map(signupRows.map((r) => [r._id, r.n]));
  const signups = Array.from({ length: 14 }, (_, i) => { const d = new Date(now - (13 - i) * DAY).toISOString().slice(0, 10); return { date: d, count: byDay.get(d) || 0 }; });

  const topUsers = await User.find({ _id: { $in: topRows.map((r) => r._id) } }).select('username bid');
  const nameOf = new Map(topUsers.map((u) => [String(u._id), u]));
  const lists = Object.fromEntries(listRows.map((r) => [r._id, r.n]));
  const d = diaryAgg[0] || { logs: 0, episodes: 0, minutes: 0, shows: 0 };

  res.json({
    users: { total, verified, unverified: total - verified, new7, new30, active7 },
    content: { logs: d.logs, episodes: d.episodes, minutes: d.minutes, shows: d.shows, reviews, seriesRatings, episodeRatings, watchlist: lists.watchlist || 0, later: lists.later || 0, favourites: lists.favourites || 0, follows },
    signups,
    topSeries: topSeries.map((s) => ({ tvId: s._id, name: s.name, posterPath: s.posterPath, logs: s.logs })),
    topUsers: topRows.map((r) => ({ username: nameOf.get(String(r._id))?.username || 'deleted user', bid: nameOf.get(String(r._id))?.bid, logs: r.logs })),
    generatedAt: new Date().toISOString()
  });
}));

/* ---------- user list with per-user statistics ---------- */
async function withStats(users) {
  const ids = users.map((u) => u._id);
  const [diary, reviews, sRatings, eRatings, lists] = await Promise.all([
    DiaryEntry.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', logs: { $sum: 1 }, episodes: { $sum: '$episodeCount' }, minutes: { $sum: { $multiply: ['$episodeCount', '$runtime'] } }, last: { $max: '$createdAt' } } }]),
    Review.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    SeriesRating.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    EpisodeRating.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    ListItem.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: { u: '$user', l: '$list' }, n: { $sum: 1 } } }])
  ]);
  const m = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const D = m(diary), R = m(reviews), S = m(sRatings), E = m(eRatings);
  return users.map((u) => {
    const id = String(u._id), d = D.get(id);
    const l = (name) => lists.find((x) => String(x._id.u) === id && x._id.l === name)?.n || 0;
    return {
      id, username: u.username, email: u.email, bid: u.bid, emailVerified: !!u.emailVerified, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null, loginCount: u.loginCount || 0,
      followers: u.followersCount || 0, following: u.followingCount || 0,
      stats: { logs: d?.logs || 0, episodes: d?.episodes || 0, minutes: d?.minutes || 0, reviews: R.get(id)?.n || 0, seriesRatings: S.get(id)?.n || 0, episodeRatings: E.get(id)?.n || 0, watchlist: l('watchlist'), later: l('later'), favourites: l('favourites') }
    };
  });
}

const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, username: { usernameLower: 1 }, followers: { followersCount: -1, createdAt: -1 }, login: { lastLoginAt: -1 } };

router.get('/users', wrap(async (req, res) => {
  const { page: p, limit, skip } = page(req.query, 20, 50);
  const q = String(req.query.q || '').trim();
  const where = { ...members };
  if (q) {
    const bid = normalizeBid(q);
    const rx = new RegExp('^' + esc(q.toLowerCase().replace(/^@/, '')));
    where.$or = [{ usernameLower: rx }, { email: rx }, ...(bid ? [{ bid }] : [])];
  }
  if (req.query.verified === 'yes') where.emailVerified = true;
  if (req.query.verified === 'no') where.emailVerified = { $ne: true };
  const [users, total] = await Promise.all([
    User.find(where).sort(SORTS[req.query.sort] || SORTS.newest).skip(skip).limit(limit),
    User.countDocuments(where)
  ]);
  res.json({ users: await withStats(users), total, page: p, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.get('/users/:id', wrap(async (req, res) => {
  const user = await User.findById(oid(req.params.id));
  if (!user) throw new HttpError(404, 'User not found.');
  const [stats] = await withStats([user]);
  const [recent, reviews] = await Promise.all([
    DiaryEntry.find({ user: user._id }).sort({ watchedOn: -1, createdAt: -1 }).limit(8).lean(),
    Review.find({ user: user._id }).sort({ createdAt: -1 }).limit(5).lean()
  ]);
  res.json({ user: { ...stats, role: user.role, bio: user.bio, avatar: publicUser(user).avatar }, recent, reviews });
}));

/* Deletes an account and everything it owns. */
router.delete('/users/:id', wrap(async (req, res) => {
  const id = oid(req.params.id);
  const user = id && (await User.findById(id));
  if (!user) throw new HttpError(404, 'User not found.');
  if (user.role === 'admin') throw new HttpError(400, 'Administrator accounts cannot be deleted here.');

  const edges = await Follow.find({ $or: [{ follower: id }, { following: id }] }).select('follower following');
  const followedBy = edges.filter((f) => String(f.following) === String(id)).map((f) => f.follower);
  const followed = edges.filter((f) => String(f.follower) === String(id)).map((f) => f.following);
  await Promise.all([
    User.updateMany({ _id: { $in: followedBy }, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
    User.updateMany({ _id: { $in: followed }, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } })
  ]);
  await Promise.all([
    Follow.deleteMany({ $or: [{ follower: id }, { following: id }] }),
    ListItem.deleteMany({ user: id }), DiaryEntry.deleteMany({ user: id }), Review.deleteMany({ user: id }),
    EpisodeRating.deleteMany({ user: id }), SeriesRating.deleteMany({ user: id }), Media.deleteMany({ user: id })
  ]);
  await User.deleteOne({ _id: id });
  res.json({ ok: true });
}));

export default router;
