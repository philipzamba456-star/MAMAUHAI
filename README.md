# Mama Uhai — Maternal Health Platform (with backend)

A working full-stack recreation of the Mama Uhai dashboards: login, Mother / Doctor / Admin portals, appointment booking, and real-time notifications — backed by a real Node.js + Express + **PostgreSQL** API.

## What's included

- **server.js** — Express API + Socket.io for real-time notifications
- **db/database.js** — Postgres schema + auto-seeding of demo accounts (runs on every boot, only seeds if the `users` table is empty)
- **routes/** — auth, users, appointments, messages, notifications, complaints, stats
- **public/index.html** — the frontend (login + 3 dashboards), calling the API directly
- **render.yaml** — Render Blueprint that provisions both the web service and a free Postgres database automatically

## Setup (local development)

1. Make sure you have **Node.js 18+** and a **PostgreSQL** server (local or remote).
2. From this folder, install dependencies:
   ```
   npm install
   ```
3. Copy the environment template and point `DATABASE_URL` at your Postgres instance:
   ```
   cp .env.example .env
   ```
   Then edit `.env`:
   ```
   DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE_NAME
   JWT_SECRET=some-long-random-string
   ```
   If you don't have Postgres running locally, the quickest option is a free Postgres instance on Render or Supabase — just paste their connection string in.
4. Start the server:
   ```
   npm start
   ```
   On first boot it creates all tables and seeds the demo accounts below.
5. Open **http://localhost:4000** in your browser.

For auto-restart on file changes during development:
```
npm run dev
```

## Demo accounts

The database seeds these on first run (file: `db/mama_uhai.sqlite`, created automatically):

| Role          | Email                  | Password   |
|---------------|-------------------------|------------|
| Administrator | admin@mamauhai.app      | admin123   |
| Doctor        | doctor@mamauhai.app     | doctor123  |
| Health Worker | health@mamauhai.app     | health123  |
| Mother        | mother@mamauhai.app     | mother123  |

You can also register new accounts via `POST /api/auth/register`.

## What actually works right now

- **Real authentication** — passwords are hashed with bcrypt, sessions use JWTs (7-day expiry).
- **Role-based dashboards** — Mother, Doctor/Health Worker, and Admin each see their own live stats pulled from the database.
- **Appointment booking** — a mother can book an appointment from the dashboard; it's saved to SQLite and instantly notifies all admins over a live Socket.io connection (no refresh needed).
- **Admin assignment** — admins can assign a provider to an appointment via `PATCH /api/appointments/:id/assign` (not yet wired to a UI button — see "Next steps").
- **Status updates** — doctors can mark an assigned appointment "completed" from their dashboard; the mother is notified live.
- **Notifications** — a live bell icon on the Mother dashboard shows unread counts and a dropdown list, updated over Socket.io as things happen.
- **User management API** — admins can list, search, filter, edit role/status, and delete users (`/api/users`), though there's no admin UI table wired up yet — only the "Recent Registrations" list.

## API reference

All endpoints are under `/api`. Authenticated routes require `Authorization: Bearer <token>`.

| Method | Path                              | Who           | Purpose                          |
|--------|------------------------------------|---------------|-----------------------------------|
| POST   | /api/auth/register                 | anyone        | Create an account                 |
| POST   | /api/auth/login                    | anyone        | Log in, get a JWT                 |
| GET    | /api/users/me                      | any logged-in | Your own profile                  |
| GET    | /api/users                         | admin         | List/search/filter users          |
| GET    | /api/users/providers                | any logged-in | List doctors + health workers     |
| PATCH  | /api/users/:id                     | admin         | Update role/status/name           |
| DELETE | /api/users/:id                     | admin         | Delete a user                     |
| GET    | /api/appointments                  | any logged-in | List your scoped appointments     |
| POST   | /api/appointments                  | mother        | Book an appointment               |
| PATCH  | /api/appointments/:id/assign        | admin         | Assign a provider                 |
| PATCH  | /api/appointments/:id/status        | admin/provider| Change status                     |
| GET    | /api/messages/conversations         | any logged-in | Your conversation list            |
| GET    | /api/messages/thread/:userId        | any logged-in | Message thread with a user        |
| POST   | /api/messages                      | any logged-in | Send a message                    |
| GET    | /api/notifications                 | any logged-in | Your notifications                |
| PATCH  | /api/notifications/:id/read         | any logged-in | Mark one as read                  |
| GET    | /api/complaints                    | any logged-in | Your complaints (or all, if admin)|
| POST   | /api/complaints                    | any logged-in | File a complaint                  |
| PATCH  | /api/complaints/:id/status           | admin         | Resolve/review a complaint        |
| GET    | /api/stats/admin                   | admin         | Dashboard stat cards               |
| GET    | /api/stats/doctor                  | doctor/health | Dashboard stat cards               |
| GET    | /api/stats/mother                  | mother        | Dashboard stat cards               |

## Next steps / not yet built

This covers the core of your spec (real-time sync for appointments/notifications, role dashboards, secure auth), but the original document described a much bigger system. Not yet implemented:

- Messaging UI (the API exists at `/api/messages`, but no chat interface is wired into the dashboards yet)
- File/image/voice-note sharing in messages
- Full admin UI for user management, content management, security/audit logs, and analytics charts
- Doctor notes, prescriptions, lab results
- Health Worker–specific views (currently shares the Doctor dashboard)
- Ride booking, hospital directory, education center content
- Offline handling / PWA support
- Production-grade database (SQLite is great for development; for real deployment with concurrent writers, consider PostgreSQL)

Happy to build out any of these next — the messaging UI and admin user-management table are probably the highest-value next additions.

## Troubleshooting

### "Failed to initialize database: ECONNREFUSED 127.0.0.1:5432" on Render

This means `DATABASE_URL` isn't reaching your app — it's falling back to trying `localhost`, which doesn't exist on Render's servers. As of this version, the app will actually refuse to start with a clear message instead of this cryptic error, but if you're still on an older deploy, here's the fix:

1. Make sure you've created a **Postgres database** on Render (New + → PostgreSQL → Free plan), separate from your web service.
2. Open that database, copy the **Internal Database URL**.
3. Go to your **web service** (not the database) → **Environment** tab → add `DATABASE_URL` with that value → **Save Changes**.
4. Make sure the web service and database are in the **same region** — internal networking only works within a region.
5. Trigger **Manual Deploy → Deploy latest commit** to make sure it picks up the change.
6. Visit `https://your-app.onrender.com/api/health` — it now reports `"database": "connected"` when things are working, or the specific connection error if not.

### Checking things quickly after any deploy

Visit `/api/health` on your live URL. You should see:
```json
{"status":"ok","database":"connected","time":"..."}
```
If `database` shows an error instead, the message will tell you what's wrong (wrong region, bad credentials, database still provisioning, etc.) without needing to dig through build logs.

### "Repository is empty" on first deploy

This means no code was pushed to the GitHub repo Render is pointed at yet. Push your code first (`git init && git add . && git commit -m "..." && git push`), then redeploy.

### Two services/environments and you're not sure which is which

Check each service's **Environment** tab to see which one has `DATABASE_URL` set — that's the one to keep using. Delete the other from its **Settings** tab → **Delete Web Service**, to avoid confusion later.

## Deploying to Render (get a real public link)

I can't create the Render account or click the deploy button for you — that part needs your login — but the repo is fully set up so it's a few clicks, and this version now includes a real Postgres database, so your data will actually persist.

**Step 1: Put this code on GitHub**
1. Go to https://github.com/new and create a new repository (public or private both work).
2. Unzip this project locally, then from that folder run:
   ```
   git init
   git add .
   git commit -m "Mama Uhai backend"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

**Step 2: Deploy on Render**
1. Go to https://dashboard.render.com and sign in (or create a free account).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account if you haven't, then select the repo you just pushed.
4. Render will detect `render.yaml` and show you two resources it's about to create: the `mama-uhai` web service and a `mama-uhai-db` free Postgres database, with `DATABASE_URL` and `JWT_SECRET` wired together automatically. Click **Apply**.
5. Wait for the build to finish (a few minutes) — Render will give you a live URL like `https://mama-uhai.onrender.com`.

That's your real, shareable link, and this time appointments, users, and messages will still be there after a restart or redeploy.

**Free-tier notes that still apply:**
- Free Postgres databases on Render **expire after 30 days** unless you upgrade to a paid database plan — fine for demoing, not for a permanent production app.
- Free web services **sleep after 15 minutes of no traffic** and take ~30-60 seconds to wake up on the next request.

For anything beyond a demo/prototype, plan to upgrade both the web service and the database to paid tiers.

