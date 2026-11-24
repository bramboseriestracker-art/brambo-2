import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { User, oid } from './models.js';

export const isProd = process.env.NODE_ENV === 'production';
export const COOKIE = 'brambo_token';
const TTL_DAYS = 7;

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---------- validation ---------- */
export const isStr = (v) => typeof v === 'string';
export const str = (v, max, { min = 0, field = 'Value' } = {}) => {
  if (!isStr(v)) throw new HttpError(400, `${field} is required.`);
  const t = v.trim();
  if (t.length < min || t.length > max) throw new HttpError(400, `${field} must be ${min}-${max} characters.`);
  return t;
};
export const int = (v, min, max, field = 'Value') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}.`);
  return n;
};
export const page = (q, def = 20, cap = 60) => {
  const p = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(cap, Math.max(1, parseInt(q.limit, 10) || def));
  return { page: p, limit, skip: (p - 1) * limit };
};
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Series snapshot stored with lists, diary entries and reviews. */
export function snapshot(b) {
  const posterPath = isStr(b.posterPath) && /^\/[\w.-]{1,80}$/.test(b.posterPath) ? b.posterPath : '';
  const backdropPath = isStr(b.backdropPath) && /^\/[\w.-]{1,80}$/.test(b.backdropPath) ? b.backdropPath : '';
  return {
    tvId: int(b.tvId, 1, 1e9, 'Series id'),
    name: str(b.name, 200, { min: 1, field: 'Series name' }),
    posterPath,
    backdropPath,
    seasons: b.seasons == null ? 0 : int(b.seasons, 0, 500, 'Seasons')
  };
}

/* ---------- Brambo ID ---------- */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const BID_RE = /^BR-[A-HJKMNP-Z2-9]{8}$/;
export const makeBid = () => 'BR-' + Array.from(crypto.randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('');
export function normalizeBid(input) {
  const t = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
  const bare = t.startsWith('BR-') ? t.slice(3) : t.startsWith('BR') && t.length === 10 ? t.slice(2) : t;
  const full = 'BR-' + bare;
  return BID_RE.test(full) ? full : null;
}
export async function assignBid(user) {
  for (let i = 0; i < 8; i++) {
    const bid = makeBid();
    try {
      const r = await User.updateOne({ _id: user._id, bid: { $exists: false } }, { $set: { bid } });
      if (r.modifiedCount) { user.bid = bid; return bid; }
      const fresh = await User.findById(user._id).select('bid');
      if (fresh?.bid) { user.bid = fresh.bid; return fresh.bid; }
    } catch (e) {
      if (e.code !== 11000) throw e; // collision: retry with a new id
    }
  }
  throw new HttpError(500, 'Could not allocate a Brambo ID.');
}

/* ---------- auth ---------- */
function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    if (isProd) throw new Error('JWT_SECRET must be set (16+ characters).');
    return 'brambo-dev-only-secret-change-me';
  }
  return s;
}
export const signToken = (id) => jwt.sign({ sub: String(id) }, secret(), { expiresIn: `${TTL_DAYS}d` });
export const setAuthCookie = (res, token) =>
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_DAYS * 86400}${isProd ? '; Secure' : ''}`);
export const clearAuthCookie = (res) =>
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`);

function readToken(req) {
  const c = /(?:^|;\s*)brambo_token=([^;]+)/.exec(req.headers.cookie || '');
  if (c) return c[1];
  const b = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  return b ? b[1] : null;
}
function identify(req) {
  const t = readToken(req);
  if (!t) return null;
  try { return oid(jwt.verify(t, secret()).sub); } catch { return null; }
}
/* Sets req.uid (ObjectId) when a valid session exists. */
export const optionalAuth = (req, _res, next) => { req.uid = identify(req); next(); };
export const requireAuth = (req, _res, next) => {
  req.uid = identify(req);
  if (!req.uid) return next(new HttpError(401, 'Please log in to continue.'));
  next();
};

/* Admin-only routes: verifies the role against the database on every call. */
export const requireAdmin = [requireAuth, async (req, _res, next) => {
  try {
    const u = await User.findById(req.uid).select('role');
    if (!u || u.role !== 'admin') return next(new HttpError(403, 'Administrator access required.'));
    next();
  } catch (e) { next(e); }
}];

/* ---------- serializers ---------- */
const mediaUrl = (id, kind, ver) => (ver ? `/api/media/${id}/${kind}?v=${ver}` : null);
export const publicUser = (u, { self = false } = {}) => ({
  role: u.role || 'user',
  emailVerified: u.role === 'admin' ? true : !!u.emailVerified,
  returning: (u.loginCount || 0) > 0,
  id: String(u._id),
  username: u.username,
  bid: u.bid || null,
  bio: u.bio || '',
  avatar: mediaUrl(u._id, 'avatar', u.avatarVer),
  banner: mediaUrl(u._id, 'banner', u.bannerVer),
  followersCount: u.followersCount || 0,
  followingCount: u.followingCount || 0,
  createdAt: u.createdAt,
  ...(self ? { email: u.email } : {})
});
export const miniUser = (u) => ({ id: String(u._id), username: u.username, bid: u.bid || null, avatar: mediaUrl(u._id, 'avatar', u.avatarVer) });

/* Resolve "me", a Brambo ID or a username to a user document. */
export async function resolveUser(handle, req, select) {
  let q;
  if (handle === 'me') {
    if (!req.uid) throw new HttpError(401, 'Please log in to continue.');
    q = { _id: req.uid };
  } else if (oid(handle) && /^[a-f\d]{24}$/i.test(handle)) {
    q = { _id: oid(handle) };
  } else {
    const bid = normalizeBid(handle);
    q = bid ? { bid } : { usernameLower: String(handle).toLowerCase() };
  }
  const u = await User.findOne(q).select(select || '');
  if (!u) throw new HttpError(404, 'User not found.');
  return u;
}
