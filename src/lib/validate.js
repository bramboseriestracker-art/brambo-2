/* Client-side checks mirror the server rules (api/_lib/email-check.js) so people get instant feedback. */
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/;
const DISPOSABLE = new Set(['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mintemail.com']);
const TYPOS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'hotnail.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'outlok.com': 'outlook.com', 'outllook.com': 'outlook.com', 'outlook.con': 'outlook.com', 'iclod.com': 'icloud.com', 'icloud.con': 'icloud.com' };

export function emailError(raw) {
  const e = String(raw || '').trim().toLowerCase();
  if (!e) return 'Enter your email address.';
  if (e.length > 254 || !EMAIL_RE.test(e) || e.includes('..')) return 'Enter a valid email address, for example name@gmail.com.';
  if (DISPOSABLE.has(e.split('@')[1])) return 'Disposable email addresses are not allowed. Use a permanent address.';
  return '';
}

/* "Did you mean ...?" for common domain typos. */
export function suggestEmail(raw) {
  const e = String(raw || '').trim().toLowerCase();
  const [local, domain] = e.split('@');
  return domain && TYPOS[domain] ? `${local}@${TYPOS[domain]}` : '';
}

export function passwordError(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must include at least one letter and one number.';
  return '';
}

/* 0-4 */
export function passwordStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (pw.length >= 12) s++;
  if (/[^A-Za-z0-9]/.test(pw) && /[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  return Math.max(1, s);
}
