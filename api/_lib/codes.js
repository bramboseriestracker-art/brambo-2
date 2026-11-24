import crypto from 'node:crypto';

const TTL_MS = 15 * 60 * 1000;
export const COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

const secret = () => process.env.JWT_SECRET || 'brambo-dev-only-secret-change-me';
const hmac = (purpose, userId, code) => crypto.createHmac('sha256', secret()).update(`${purpose}:${userId}:${code}`).digest('hex');

/* Creates a 6-digit code. Store `record` on the user; email `code`. */
export function newCode(purpose, userId) {
  const code = String(crypto.randomInt(100000, 1000000));
  return { code, record: { hash: hmac(purpose, userId, code), expires: new Date(Date.now() + TTL_MS), attempts: 0, sentAt: new Date() } };
}

/* 'ok' | 'none' | 'expired' | 'locked' | 'wrong' */
export function checkCode(record, purpose, userId, code) {
  if (!record?.hash) return 'none';
  if (record.expires < new Date()) return 'expired';
  if ((record.attempts || 0) >= MAX_ATTEMPTS) return 'locked';
  const a = Buffer.from(hmac(purpose, userId, String(code || '').trim()), 'hex');
  const b = Buffer.from(record.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? 'ok' : 'wrong';
}

export const cooldownLeft = (record) => (record?.sentAt ? Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - new Date(record.sentAt))) / 1000)) : 0);

export const CODE_MESSAGES = {
  none: 'No active code. Request a new one.',
  expired: 'That code has expired. Request a new one.',
  locked: 'Too many wrong attempts. Request a new code.',
  wrong: 'That code is not correct.'
};
