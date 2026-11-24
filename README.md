# Brambo

Series tracker built with React (Vite), Vercel serverless functions and MongoDB Atlas. Series data comes from TMDB through a server-side proxy, so the API key never reaches the browser.

## Features
- **Accounts:** sign-up with email validation (format, disposable-domain block, DNS check, 6-digit email verification), login by username or email, forgot password by email code, one login page for users and the admin
- **Admin dashboard (`/admin`):** user statistics, sign-ups chart, most logged series, searchable and sortable user table with per-user details, delete user
- **Series page:** three ratings (Your rating, Brambo's rating = average of members' ratings, TMDB's rating), animated season and episode panels, cast, reviews, "More like this"
- **Popcorn ratings:** below 5.0 burst, 5.0 to 7.4 solid, 7.5 and above strong; the number is always shown next to the popcorn
- **Diary, lists, profile, followers/following,** Brambo ID search, most active members on the Friends page
- **Search:** instant from the first character (local index plus live TMDB results)

## Run locally
```bash
npm install
cp .env.example .env          # fill in MONGODB_URI, JWT_SECRET, TMDB_API_KEY (and ADMIN_* values)
npm run db:setup -- --demo    # indexes, admin account, demo account
npm run dev                   # API on :5000, site on http://localhost:5173
```
Without SMTP settings, verification and reset codes are printed in the terminal that runs the API (look for `[mail:dev]`).
Demo logins: `demo` / `demo12345` (user) and `admin` / `Admin12345` (admin, only when no ADMIN_* variables are set).

Tests (API running, same `.env`): `npm run test:api`, `npm run test:auth`, `npm run test:filters`.

---

# Deploy to Vercel, step by step

You need free accounts on **GitHub**, **MongoDB Atlas**, **TMDB**, **Vercel**, and an email account that can send mail by SMTP (a Gmail account works).

## Step 1. Database (MongoDB Atlas)
1. Sign in at https://cloud.mongodb.com and create a project, then **Create a cluster** (the free **M0** tier is enough).
2. **Database Access** > **Add New Database User**: choose a username and a strong password (letters and numbers only avoids URL-encoding problems). Give it **Read and write to any database**.
3. **Network Access** > **Add IP Address** > **Allow access from anywhere** (`0.0.0.0/0`). Vercel does not use fixed IP addresses, so this is required.
4. **Database** > **Connect** > **Drivers**. Copy the connection string and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/brambo?retryWrites=true&w=majority`
   Keep it. This is `MONGODB_URI`.

## Step 2. TMDB key
Create an account at https://www.themoviedb.org, then **Settings** > **API** and request a key. Copy the **API Key (v3 auth)**. This is `TMDB_API_KEY`.

## Step 3. Email (SMTP) for verification and password reset
Using Gmail:
1. Open your Google Account > **Security** and turn on **2-Step Verification**.
2. Search for **App passwords**, create one named "Brambo" and copy the 16-character password.
3. Your settings are: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=your@gmail.com`, `SMTP_PASS=<the 16-character app password>`, `MAIL_FROM="Brambo <your@gmail.com>"`.

Gmail allows roughly 500 messages a day. For more volume use Brevo, Mailgun, Amazon SES or Resend; they all give you the same four SMTP values.

## Step 4. Create a session secret
Run this and copy the result. This is `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Step 5. Prepare the production database (run once from your computer)
1. Create `.env` from `.env.example` and fill in **the production values**: `MONGODB_URI`, `JWT_SECRET`, `TMDB_API_KEY`, and the admin account you want:
   ```
   ADMIN_USERNAME=admin
   ADMIN_EMAIL=you@yourdomain.com
   ADMIN_PASSWORD=<a strong password with letters and numbers>
   ```
2. Run:
   ```bash
   npm install
   npm run db:setup
   ```
   Do **not** use `--demo` here. This creates all indexes and the admin account, and upgrades accounts created by older versions (they become verified, so existing users are not locked out).
3. To change the admin password later, edit `ADMIN_PASSWORD` and run `npm run db:setup` again.

## Step 6. Push the code to GitHub
```bash
git init
git add .
git commit -m "Brambo"
git branch -M main
git remote add origin https://github.com/<your-user>/brambo.git
git push -u origin main
```
`.env` is listed in `.gitignore` and must never be pushed.

## Step 7. Import the project in Vercel
1. Sign in at https://vercel.com with GitHub. Click **Add New...** > **Project** and import the `brambo` repository.
2. Vercel detects **Vite** from `vercel.json`. Leave **Build Command** `npm run build` and **Output Directory** `dist`.
3. Open **Environment Variables** and add these (apply to Production, Preview and Development):

| Name | Value |
|---|---|
| `MONGODB_URI` | the Atlas connection string from Step 1 |
| `JWT_SECRET` | the secret from Step 4 |
| `TMDB_API_KEY` | the TMDB key from Step 2 |
| `SMTP_HOST` | `smtp.gmail.com` (or your provider) |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | your sending address |
| `SMTP_PASS` | the app password |
| `MAIL_FROM` | `Brambo <your@gmail.com>` |

The `ADMIN_*` variables are only needed on your computer for `db:setup`; they do not need to be in Vercel.

4. Click **Deploy**. The first build takes about a minute.

## Step 8. Check the deployment
1. Open `https://<your-project>.vercel.app/api/health`. It must show `{"ok":true}`.
2. Open the site. Rows of posters on the landing page confirm TMDB works.
3. Sign up with a real email. You should receive a 6-digit code within a minute, and after entering it you land on Home with "Welcome to Brambo".
4. Log out, then log in at the same login page with the admin username and password from Step 5. You are taken to `/admin`.
5. Try **Forgot password?** to confirm reset emails work.

## Step 9. Recommended settings
- **Function region:** Project Settings > **Functions** > choose the region closest to your Atlas cluster (for example Mumbai `bom1` if Atlas runs in AWS Mumbai). This removes most database latency.
- **Custom domain:** Project Settings > **Domains** > add your domain and follow the DNS instructions. HTTPS is automatic.
- **Changing an environment variable:** save it, then open **Deployments** > the latest deployment > **Redeploy**. New values apply only to new deployments.
- Every push to `main` deploys automatically. Pull requests get preview URLs.

## Troubleshooting
| Symptom | Cause and fix |
|---|---|
| Posters missing, "Series data is unavailable" | `TMDB_API_KEY` missing or wrong. Fix it in Vercel and redeploy. |
| Sign-up returns an error about the server | `MONGODB_URI` wrong, or Atlas Network Access does not allow `0.0.0.0/0`. |
| `/api/health` works but login fails with 500 | `JWT_SECRET` missing or shorter than 16 characters. |
| No verification email | SMTP values wrong. Check Vercel > Logs for "Mail (verify) failed". For Gmail the password must be an App Password, not the account password. The user can press **Resend code**. |
| Existing users are asked to verify their email | `npm run db:setup` was not run after upgrading. Run it once. |
| Cannot log in as admin | Run `npm run db:setup` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set, then log in with that username (default `admin`). |
| Large profile pictures fail | Pictures are compressed in the browser, any size is accepted. If it still fails, try another image. The stored copy is limited to about 1.4 MB because Vercel limits requests to 4.5 MB. |

---

## Structure
```
api/_lib/        db.js, models.js, util.js, mailer.js, email-check.js, codes.js, routes-*.js, app.js
api/[...path].js Vercel entry (one Express function serves every /api route)
src/             pages, components, lib (api client, auth, search, discover filters, image compression)
scripts/         setup-db.js, smoke-test.mjs, auth-test.mjs, test-filters.mjs
design/          original logo artwork (public/logo.png is the optimised copy used by the site)
```

## Collections
| Collection | Purpose |
|---|---|
| users | account, role (user/admin), Brambo ID, email verification, login count, one-time code hashes |
| media | avatar and banner images |
| follows | follower to following edges |
| listitems | watch list, watch later, favourites |
| diaryentries | one entry per season watched |
| reviews | one review per user per series |
| seriesratings | one overall rating per user per series (Your rating, Brambo's rating) |
| episoderatings | per-user episode ratings |

## Security notes
HttpOnly, SameSite=Lax, Secure cookie sessions; bcrypt (12 rounds); one-time codes stored only as HMAC hashes, valid 15 minutes, 5 attempts, 60-second resend cooldown; the forgot-password endpoint gives the same answer for unknown emails; rate-limited auth, email and TMDB endpoints; admin role re-checked in the database on every `/api/admin` call; allow-listed TMDB paths; input validation on every write; Helmet on the API, CSP and HSTS on the site.
Known limitation: a password reset does not sign out sessions that already exist (they expire after 7 days). Rotating `JWT_SECRET` signs everyone out.
