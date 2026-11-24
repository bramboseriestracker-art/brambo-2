/* Tests email verification, password reset, admin API, series ratings and active users.
   Needs the API running plus the same .env (MONGODB_URI, JWT_SECRET) so it can place known one-time codes in the database. */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../api/_lib/db.js';
import { User } from '../api/_lib/models.js';
import { newCode } from '../api/_lib/codes.js';

const BASE = process.argv[2] || 'http://localhost:5000';
let failed = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) failed++; };
function client() {
  let cookie = '';
  return async (path, method = 'GET', body) => {
    const r = await fetch(BASE + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {}
    return { s: r.status, j };
  };
}
await connectDB();
const sfx = Math.random().toString(36).slice(2, 8);
const U = client(), A = client(), V = client();
const TV = 900000 + Math.floor(Math.random() * 90000);
const snap = { tvId: TV, name: 'Game of Thrones', posterPath: '/p.jpg', seasons: 8 };

/* ---- signup validation ---- */
let r = await U('/auth/signup', 'POST', { username: `u_${sfx}`, email: 'not-an-email', password: 'password1' }); ok(r.s === 400, 'invalid email rejected');
r = await U('/auth/signup', 'POST', { username: `u_${sfx}`, email: `a@mailinator.com`, password: 'password1' }); ok(r.s === 400 && /isposable/.test(r.j.message), 'disposable email rejected');
r = await U('/auth/signup', 'POST', { username: `u_${sfx}`, email: `a..b@x.io`, password: 'password1' }); ok(r.s === 400, 'double-dot email rejected');
r = await U('/auth/signup', 'POST', { username: `u_${sfx}`, email: `u_${sfx}@x.io`, password: 'allletters' }); ok(r.s === 400, 'password without a number rejected');
r = await U('/auth/signup', 'POST', { username: `u_${sfx}`, email: `u_${sfx}@x.io`, password: 'password1' });
ok(r.s === 201 && r.j.user.emailVerified === false && r.j.user.returning === false && r.j.user.role === 'user', 'signup: unverified, new (not returning), role user');
const uid = r.j.user.id;

/* ---- verification ---- */
r = await U('/auth/verify-email', 'POST', { code: '000000' }); ok(r.s === 400, 'wrong verification code rejected');
let u = await User.findById(uid).select('+emailCode'); ok(u.emailCode.attempts === 1, 'wrong attempt counted');
r = await U('/auth/resend-verification', 'POST'); ok(r.s === 429, 'resend blocked by 60 s cooldown');
const c1 = newCode('verify', uid); await User.updateOne({ _id: uid }, { $set: { emailCode: c1.record } });
r = await U('/auth/verify-email', 'POST', { code: c1.code }); ok(r.s === 200 && r.j.user.emailVerified === true, 'correct code verifies the email');
const c2 = newCode('verify', uid); c2.record.expires = new Date(Date.now() - 1000);
await User.updateOne({ _id: uid }, { $set: { emailVerified: false, emailCode: c2.record } });
r = await U('/auth/verify-email', 'POST', { code: c2.code }); ok(r.s === 400 && /expired/.test(r.j.message), 'expired code rejected');
const c3 = newCode('verify', uid); c3.record.attempts = 5; await User.updateOne({ _id: uid }, { $set: { emailCode: c3.record } });
r = await U('/auth/verify-email', 'POST', { code: c3.code }); ok(r.s === 400 && /Too many/.test(r.j.message), 'code locks after 5 wrong attempts');
await User.updateOne({ _id: uid }, { $set: { emailVerified: true } });

/* ---- login counts / welcome state ---- */
const L = client();
r = await L('/auth/login', 'POST', { identifier: `u_${sfx}`, password: 'password1' }); ok(r.s === 200 && r.j.user.returning === true, 'after a login the user is "returning"');

/* ---- forgot / reset ---- */
r = await V('/auth/forgot-password', 'POST', { email: `nobody_${sfx}@x.io` }); ok(r.s === 200 && r.j.ok, 'forgot-password: unknown email gets the same answer');
r = await V('/auth/forgot-password', 'POST', { email: `u_${sfx}@x.io` }); ok(r.s === 200, 'forgot-password: known email answered');
u = await User.findById(uid).select('+resetCode'); ok(!!u.resetCode?.hash, 'reset code stored as a hash');
r = await V('/auth/reset-password', 'POST', { email: `u_${sfx}@x.io`, code: '111111', password: 'newpass123' }); ok(r.s === 400, 'wrong reset code rejected');
const rc = newCode('reset', uid); await User.updateOne({ _id: uid }, { $set: { resetCode: rc.record } });
r = await V('/auth/reset-password', 'POST', { email: `u_${sfx}@x.io`, code: rc.code, password: 'short' }); ok(r.s === 400, 'weak new password rejected');
r = await V('/auth/reset-password', 'POST', { email: `u_${sfx}@x.io`, code: rc.code, password: 'newpass123' }); ok(r.s === 200, 'reset with correct code');
r = await V('/auth/reset-password', 'POST', { email: `u_${sfx}@x.io`, code: rc.code, password: 'another123' }); ok(r.s === 400, 'reset code is single use');
r = await (client())('/auth/login', 'POST', { identifier: `u_${sfx}@x.io`, password: 'password1' }); ok(r.s === 401, 'old password no longer works');
r = await (client())('/auth/login', 'POST', { identifier: `u_${sfx}@x.io`, password: 'newpass123' }); ok(r.s === 200, 'new password works (login by email)');

/* ---- series ratings ---- */
const B = client(); await B('/auth/signup', 'POST', { username: `b_${sfx}`, email: `b_${sfx}@x.io`, password: 'password1' });
await User.updateOne({ username: `b_${sfx}` }, { $set: { emailVerified: true } });
r = await L(`/series-ratings/${TV}`, 'PUT', { rating: 9 }); ok(r.s === 200 && r.j.mine === 9, 'rate a series (overall)');
r = await B(`/series-ratings/${TV}`, 'PUT', { rating: 6 }); ok(r.j.avg === 7.5 && r.j.count === 2, 'Brambo rating is the average of user ratings');
r = await L(`/series-ratings/${TV}`); ok(r.j.mine === 9 && r.j.avg === 7.5, 'your rating and Brambo rating returned together');
r = await L(`/series-ratings/${TV}`, 'PUT', { rating: 11 }); ok(r.s === 400, 'series rating range enforced');
r = await B('/reviews', 'POST', { ...snap, rating: 8, text: 'Great series' }); r = await B(`/series-ratings/${TV}`); ok(r.j.mine === 8, 'review rating syncs to the series rating');
r = await B(`/series-ratings/${TV}`, 'PUT', { rating: 0 }); ok(r.j.count === 1, 'clearing a rating');

/* ---- active users / search ---- */
await L('/diary', 'POST', { ...snap, season: 1, episodeCount: 10, runtime: 60, watchedOn: '2026-03-02' });
r = await B('/users/active'); ok(r.s === 200 && r.j.users.some((x) => x.username === `u_${sfx}` && x.activity.logs >= 1), 'active users list ranks recent activity');
ok(!r.j.users.some((x) => x.username === `b_${sfx}`) && !r.j.users.some((x) => x.role === 'admin'), 'active list excludes yourself and admins');
r = await B(`/users/search?q=${`u`}`); ok(r.j.users.length >= 1, 'user search works with a single character');

/* ---- admin ---- */
r = await L('/admin/overview'); ok(r.s === 403, 'regular user cannot open the admin API');
r = await (client())('/admin/overview'); ok(r.s === 401, 'anonymous cannot open the admin API');
r = await A('/auth/login', 'POST', { identifier: 'admin', password: 'Admin12345' }); ok(r.s === 200 && r.j.user.role === 'admin', 'admin logs in on the normal login endpoint');
r = await A('/admin/overview'); ok(r.s === 200 && r.j.users.total >= 2 && r.j.signups.length === 14 && r.j.content.logs >= 1, 'admin overview statistics');
r = await A(`/admin/users?q=u_${sfx}`); ok(r.s === 200 && r.j.users.length === 1 && r.j.users[0].stats.logs === 1 && r.j.users[0].email === `u_${sfx}@x.io`, 'admin user list with details and stats');
r = await A('/admin/users?verified=no&sort=username'); ok(r.s === 200, 'admin list filters and sorting');
const target = (await A(`/admin/users?q=b_${sfx}`)).j.users[0];
r = await A(`/admin/users/${target.id}`); ok(r.s === 200 && r.j.user.username === `b_${sfx}`, 'admin user detail');
await L(`/users/b_${sfx}/follow`, 'POST');
r = await A(`/admin/users/${target.id}`, 'DELETE'); ok(r.s === 200, 'admin deletes a user');
r = await A(`/admin/users?q=b_${sfx}`); ok(r.j.users.length === 0, 'deleted user is gone');
const me = await L('/users/me'); ok(me.j.user.followingCount === 0, 'follower counters corrected after deletion');
const adminRow = await User.findOne({ role: 'admin' }); r = await A(`/admin/users/${adminRow._id}`, 'DELETE'); ok(r.s === 400, 'admin account cannot be deleted');

await User.deleteMany({ username: new RegExp(`_${sfx}$`) });
await mongoose.disconnect();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
