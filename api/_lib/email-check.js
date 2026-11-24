import dns from 'node:dns/promises';

const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/;
const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mintemail.com']);

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))]);

/* Returns { ok: true, email } or { ok: false, message }.
   1. syntax  2. disposable-domain block  3. the domain must publish mail (MX) or address (A) records. */
export async function checkEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email) || email.includes('..') || email.split('@')[0].startsWith('.') || email.split('@')[0].endsWith('.')) {
    return { ok: false, message: 'Enter a valid email address.' };
  }
  const domain = email.split('@')[1];
  if (DISPOSABLE.has(domain)) return { ok: false, message: 'Disposable email addresses are not allowed. Use a permanent address.' };
  if (process.env.EMAIL_MX_CHECK === 'off') return { ok: true, email };
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 2500);
    if (mx.length) return { ok: true, email };
  } catch (e) {
    if (e.code === 'ENOTFOUND' || e.code === 'ENODATA') {
      try { if ((await withTimeout(dns.resolve4(domain), 2500)).length) return { ok: true, email }; } catch (e2) { if (e2.code !== 'ENOTFOUND' && e2.code !== 'ENODATA') return { ok: true, email }; }
      return { ok: false, message: `The domain "${domain}" cannot receive email. Check the address for typos.` };
    }
    /* Resolver timeout or network failure: not conclusive, so do not block the user. */
    return { ok: true, email };
  }
  return { ok: false, message: `The domain "${domain}" cannot receive email. Check the address for typos.` };
}

export function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 72) return 'Password must be 8-72 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must include at least one letter and one number.';
  return null;
}
