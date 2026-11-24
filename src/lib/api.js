export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message || `Request failed (${res.status}).`, res.status);
  return data;
}

/* ---------- TMDB (via server proxy) ---------- */
const cache = new Map();
export function tmdb(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const key = path + '?' + qs;
  if (!cache.has(key)) {
    const p = fetch(`/api/tmdb/${path.replace(/^\//, '')}${qs ? '?' + qs : ''}`)
      .then(async (r) => {
        if (!r.ok) throw new ApiError((await r.json().catch(() => ({}))).message || 'TMDB request failed.', r.status);
        return r.json();
      })
      .catch((e) => { cache.delete(key); throw e; });
    cache.set(key, p);
  }
  return cache.get(key);
}

const IMG = 'https://image.tmdb.org/t/p';
export const img = (p, size = 'w342') => (p ? `${IMG}/${size}${p}` : null);

/* Fetch every season of a series with as few requests as possible (TMDB allows 20 appended calls). */
export async function tmdbSeasons(id, numbers) {
  const chunks = [];
  for (let i = 0; i < numbers.length; i += 20) chunks.push(numbers.slice(i, i + 20));
  const parts = await Promise.all(chunks.map((c) => tmdb(`tv/${id}`, { append_to_response: c.map((n) => `season/${n}`).join(',') })));
  const out = {};
  parts.forEach((p) => numbers.forEach((n) => { if (p[`season/${n}`]) out[n] = p[`season/${n}`]; }));
  return out;
}

/* ---------- helpers ---------- */
export const shuffle = (l) => { const c = l.slice(); for (let i = c.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [c[i], c[j]] = [c[j], c[i]]; } return c; };
export const iso = (d) => d.toISOString().slice(0, 10);
export const daysFrom = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
export const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const fmtTime = (m) => { const h = Math.floor(m / 60); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m % 60}m`; };
export const fmtDate = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (d ? new Date(d).toLocaleDateString(undefined, { timeZone: 'UTC', ...o }) : '');
export const snap = (s) => ({ tvId: s.id, name: s.name, posterPath: s.poster_path || '', backdropPath: s.backdrop_path || '', seasons: s.number_of_seasons || 0 });
export const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
