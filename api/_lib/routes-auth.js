import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from './models.js';
import { wrap, HttpError, isStr, makeBid, assignBid, signToken, setAuthCookie, clearAuthCookie, publicUser, requireAuth } from './util.js';
import { checkEmail, checkPassword } from './email-check.js';
import { newCode, checkCode, cooldownLeft, CODE_MESSAGES, MAX_ATTEMPTS } from './codes.js';
import { sendMail, codeMessage } from './mailer.js';

const router = Router();
const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;
const ROUNDS = 12;
const DUMMY = bcrypt.hashSync('brambo-dummy-password', ROUNDS);
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Try again in a few minutes.' } });
const mailLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many email requests. Try again in a few minutes.' } });

/* Sends a one-time code. Returns false when the mail could not be sent. */
async function deliver(kind, user, code) {
  try { await sendMail({ to: user.email, ...codeMessage(kind, user.username, code) }); return true; }
  catch (e) { console.error(`Mail (${kind}) failed:`, e.message); return false; }
}

router.post('/signup', limiter, wrap(async (req, res) => {
  const { username, email, password } = req.body || {};
  if (![username, email, password].every(isStr)) throw new HttpError(400, 'Username, email and password are required.');
  const name = username.trim();
  if (!USERNAME_RE.test(name)) throw new HttpError(400, 'Username must be 3-20 letters, numbers, dots or underscores.');
  const em = await checkEmail(email);
  if (!em.ok) throw new HttpError(400, em.message);
  const pwError = checkPassword(password);
  if (pwError) throw new HttpError(400, pwError);
  if (await User.exists({ usernameLower: name.toLowerCase() })) throw new HttpError(409, 'That username is taken.');
  if (await User.exists({ email: em.email })) throw new HttpError(409, 'An account with that email already exists.');

  const passwordHash = await bcrypt.hash(password, ROUNDS);
  let user;
  for (let i = 0; i < 6 && !user; i++) {
    try {
      user = await User.create({ username: name, usernameLower: name.toLowerCase(), email: em.email, passwordHash, bid: makeBid(), emailVerified: false });
    } catch (e) {
      if (e.code === 11000 && e.keyPattern?.bid) continue; // Brambo ID collision, retry
      throw e;
    }
  }
  if (!user) throw new HttpError(500, 'Could not create the account. Try again.');

  const { code, record } = newCode('verify', user._id);
  await User.updateOne({ _id: user._id }, { $set: { emailCode: record } });
  const emailSent = await deliver('verify', user, code);
  setAuthCookie(res, signToken(user._id));
  res.status(201).json({ user: publicUser(user, { self: true }), emailSent });
}));

router.post('/login', limiter, wrap(async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!isStr(identifier) || !isStr(password)) throw new HttpError(400, 'Enter your username or email and password.');
  const id = identifier.trim().toLowerCase();
  const user = await User.findOne({ $or: [{ usernameLower: id }, { email: id }] }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY);
  if (!user || !ok) throw new HttpError(401, 'Username, email or password is incorrect.');
  if (!user.bid) await assignBid(user); // backfill accounts created before Brambo IDs existed
  user.loginCount = (user.loginCount || 0) + 1;
  user.lastLoginAt = new Date();
  await User.updateOne({ _id: user._id }, { $set: { loginCount: user.loginCount, lastLoginAt: user.lastLoginAt } });
  setAuthCookie(res, signToken(user._id));
  res.json({ user: publicUser(user, { self: true }) });
}));

router.post('/logout', (_req, res) => { clearAuthCookie(res); res.json({ ok: true }); });

router.get('/me', requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.uid);
  if (!user) { clearAuthCookie(res); throw new HttpError(401, 'Session expired. Please log in again.'); }
  if (!user.bid) await assignBid(user);
  res.json({ user: publicUser(user, { self: true }) });
}));

/* ---------- email verification ---------- */
router.post('/verify-email', limiter, requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.uid).select('+emailCode');
  if (!user) throw new HttpError(401, 'Session expired. Please log in again.');
  if (user.emailVerified || user.role === 'admin') return res.json({ user: publicUser(user, { self: true }) });
  const result = checkCode(user.emailCode, 'verify', user._id, req.body?.code);
  if (result !== 'ok') {
    if (result === 'wrong') await User.updateOne({ _id: user._id }, { $inc: { 'emailCode.attempts': 1 } });
    throw new HttpError(400, CODE_MESSAGES[result]);
  }
  user.emailVerified = true;
  await User.updateOne({ _id: user._id }, { $set: { emailVerified: true }, $unset: { emailCode: '' } });
  res.json({ user: publicUser(user, { self: true }) });
}));

router.post('/resend-verification', mailLimiter, requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.uid).select('+emailCode');
  if (!user) throw new HttpError(401, 'Session expired. Please log in again.');
  if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  const wait = cooldownLeft(user.emailCode);
  if (wait) throw new HttpError(429, `Wait ${wait} seconds before requesting another code.`);
  const { code, record } = newCode('verify', user._id);
  await User.updateOne({ _id: user._id }, { $set: { emailCode: record } });
  if (!(await deliver('verify', user, code))) throw new HttpError(502, 'The email could not be sent. Try again shortly.');
  res.json({ ok: true });
}));

/* ---------- forgot / reset password ---------- */
/* Always answers the same way so the endpoint cannot be used to discover which emails are registered. */
router.post('/forgot-password', mailLimiter, wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid email address.');
  const user = await User.findOne({ email }).select('+resetCode');
  if (user && !cooldownLeft(user.resetCode)) {
    const { code, record } = newCode('reset', user._id);
    await User.updateOne({ _id: user._id }, { $set: { resetCode: record } });
    await deliver('reset', user, code);
  }
  res.json({ ok: true, message: 'If an account exists for that email, a 6-digit code has been sent.' });
}));

router.post('/reset-password', limiter, wrap(async (req, res) => {
  const { email, code, password } = req.body || {};
  if (![email, code, password].every(isStr)) throw new HttpError(400, 'Email, code and new password are required.');
  const pwError = checkPassword(password);
  if (pwError) throw new HttpError(400, pwError);
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+resetCode');
  if (!user) throw new HttpError(400, CODE_MESSAGES.wrong);
  const result = checkCode(user.resetCode, 'reset', user._id, code);
  if (result !== 'ok') {
    if (result === 'wrong') await User.updateOne({ _id: user._id }, { $inc: { 'resetCode.attempts': 1 } });
    throw new HttpError(400, CODE_MESSAGES[result] + (result === 'wrong' ? ` (${MAX_ATTEMPTS} attempts allowed)` : ''));
  }
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  /* Proving access to the mailbox also verifies the address. */
  await User.updateOne({ _id: user._id }, { $set: { passwordHash, emailVerified: true }, $unset: { resetCode: '' } });
  res.json({ ok: true, message: 'Password updated. You can now log in.' });
}));

export default router;
