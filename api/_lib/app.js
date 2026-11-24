import express from 'express';
import helmet from 'helmet';
import { connectDB } from './db.js';
import { HttpError, wrap } from './util.js';
import auth from './routes-auth.js';
import users from './routes-users.js';
import content from './routes-content.js';
import tmdb from './routes-tmdb.js';
import admin from './routes-admin.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' } }));
/* Small JSON limit everywhere except the image upload routes, which declare their own larger limit. */
const smallJson = express.json({ limit: '20kb' });
app.use((req, res, next) => (req.path.startsWith('/api/me/media') ? next() : smallJson(req, res, next)));

/* No database needed */
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/tmdb', tmdb);

app.use('/api', wrap(async (_req, _res, next) => { await connectDB(); next(); }));
app.use('/api/auth', auth);
app.use('/api/admin', admin);
app.use('/api', users);
app.use('/api', content);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
  if (err?.code === 11000) return res.status(409).json({ message: 'That value is already in use.' });
  if (err?.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier.' });
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  console.error('API error:', err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

export default app;
