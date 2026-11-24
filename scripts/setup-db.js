/* Database setup. Run once per environment, and again after upgrading or to change the admin password:
     node scripts/setup-db.js [--demo]
   - creates/synchronises every index (production does not auto-build indexes)
   - upgrades older data: Brambo IDs, verified email and login count for existing accounts,
     and copies existing review ratings into the new series-rating collection
   - creates or updates the ADMIN account from ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD
   - --demo (development only) also creates demo / demo12345 and, if no admin variables are set, admin / Admin12345 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../api/_lib/db.js';
import * as M from '../api/_lib/models.js';
import { assignBid, makeBid } from '../api/_lib/util.js';
import { checkPassword } from '../api/_lib/email-check.js';

const demo = process.argv.includes('--demo');
if (demo && process.env.NODE_ENV === 'production') throw new Error('Refusing to create demo accounts in production.');

await connectDB();
for (const m of [M.User, M.Media, M.Follow, M.ListItem, M.DiaryEntry, M.Review, M.EpisodeRating, M.SeriesRating]) {
  await m.syncIndexes();
  console.log('indexes synced:', m.collection.name);
}

/* ---- upgrade existing data ---- */
let n = 0;
for await (const u of M.User.find({ bid: { $exists: false } })) { await assignBid(u); n++; }
console.log(`backfilled ${n} Brambo ID(s)`);
const v = await M.User.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
const l = await M.User.updateMany({ loginCount: { $exists: false } }, { $set: { loginCount: 1 } });
const r = await M.User.updateMany({ role: { $exists: false } }, { $set: { role: 'user' } });
console.log(`existing accounts upgraded: ${v.modifiedCount} verified, ${l.modifiedCount} login counts, ${r.modifiedCount} roles`);
let copied = 0;
for await (const rv of M.Review.find({}).select('user tvId rating').lean()) {
  const res = await M.SeriesRating.updateOne({ user: rv.user, tvId: rv.tvId }, { $setOnInsert: { rating: rv.rating } }, { upsert: true });
  copied += res.upsertedCount;
}
console.log(`series ratings created from reviews: ${copied}`);

/* ---- accounts ---- */
async function upsertAccount({ username, email, password, role }) {
  const pwError = checkPassword(password);
  if (pwError) throw new Error(`${role} password rejected: ${pwError}`);
  email = email.trim().toLowerCase();
  const lower = username.toLowerCase();
  const clash = await M.User.findOne({ $or: [{ usernameLower: lower }, { email }] });
  const passwordHash = await bcrypt.hash(password, 12);
  if (clash && clash.role !== role) throw new Error(`Cannot create ${role} "${username}": that username or email belongs to a regular account.`);
  if (clash) { await M.User.updateOne({ _id: clash._id }, { $set: { username, usernameLower: lower, email, passwordHash, emailVerified: true } }); return 'updated'; }
  await M.User.create({ username, usernameLower: lower, email, passwordHash, role, emailVerified: true, bid: makeBid(), loginCount: role === 'admin' ? 1 : 0 });
  return 'created';
}

const adminEnv = process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD;
if (adminEnv) {
  console.log(`admin account ${await upsertAccount({ username: process.env.ADMIN_USERNAME || 'admin', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, role: 'admin' })}: ${process.env.ADMIN_USERNAME || 'admin'}`);
} else if (demo) {
  console.log(`admin account ${await upsertAccount({ username: 'admin', email: 'admin@brambo.app', password: 'Admin12345', role: 'admin' })}: admin / Admin12345 (demo only)`);
} else {
  console.log('No admin account configured. Set ADMIN_EMAIL and ADMIN_PASSWORD (and optionally ADMIN_USERNAME) and run this script again.');
}
if (demo) console.log(`demo account ${await upsertAccount({ username: 'demo', email: 'demo@brambo.app', password: 'demo12345', role: 'user' })}: demo / demo12345`);

await mongoose.disconnect();
