/* Local API server (the Vercel function runs the same Express app). */
import 'dotenv/config';
import app from './api/_lib/app.js';

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Brambo API on http://localhost:${port}`));
