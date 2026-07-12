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
- **Appointment booking** — a mother can book an appointment from the dashboard; it's saved to Postgres and instantly notifies all admins over Socket.io (no refresh needed).
- **Admin appointment management** — a full Appointments & Allocations view lets admins assign a provider and change status on any appointment.
- **Status updates** — doctors can mark an assigned appointment "completed" from their dashboard; the mother is notified live.
- **Messaging** — real conversations between mothers, doctors, health workers, and admins, with a live thread view, unread badges, and instant delivery over Socket.io. A "new conversation" picker scopes who you can message based on your role (mothers see their providers, doctors see their patients, admins see everyone).
- **Find a Doctor** — mothers can browse real doctors/health workers and either message them or start booking an appointment with them pre-filled.
- **Admin user management** — a full table of every real user: search, filter by role, edit role/status inline, delete. Suspending an account genuinely blocks that user's login until reactivated.
- **Doctor's "My Patients"** — a real list of the doctor's assigned patients, derived from their appointments, with a one-click message button.
- **Complaints** — mothers can file a complaint/report from their dashboard; admins see and resolve all complaints from theirs.
- **Mama AI** — a real AI chat assistant (see below) with a polished, friendly interface: gradient bubbles, typing indicator, and suggested-question chips.
- **Health Insights** — a mother sets her due date, and the app computes her current pregnancy week and shows a relevant fact about her baby's development that week.
- **Digital Passport** — a mother's own profile plus her full visit history in one place, pulled live from the database.
- **Transport** — mothers can request a ride (pickup/destination), see their ride history, and admins are notified of new requests live; ride counts show up in the admin dashboard.
- **Hospitals / Services / Education Center / Costs** — informational directories and content, written for a Ugandan context (real hospital names, realistic cost estimates in UGX, practical pregnancy/newborn guidance).
- **Accessibility: Large Text** — a genuine site-wide font-size toggle for the mother dashboard, persisted across visits.
- **Notifications** — a live bell icon shows unread counts and a dropdown list, updated over Socket.io as things happen across appointments, rides, and messages.

### Setting up Mama AI

Mama AI is a real integration with Anthropic's Claude API, not a canned/scripted chatbot. To activate it:

1. Get an API key at https://console.anthropic.com/settings/keys
2. Add it as an environment variable: `ANTHROPIC_API_KEY=sk-ant-...`
   - Locally: add it to your `.env` file
   - On Render: add it under your web service's **Environment** tab
3. Optionally set `CLAUDE_MODEL` to choose a specific model (defaults to `claude-sonnet-5`)

Without a key set, Mama AI still opens and looks complete, but replying shows a friendly "not configured yet" message instead of crashing — so the rest of the app works fine even before you've added a key.

**Cost note:** every message sent to Mama AI is a real API call billed to whichever Anthropic account owns the key. There's no per-user rate limiting built in yet — for a public-facing deployment, consider adding request throttling before wide release.

## Still not built (or intentionally simplified)

- File/image/voice-note sharing in messages
- Content management for admins (publishing/editing articles, announcements) — Education Center content is currently static, not admin-editable
- Security/audit logs, login history
- Doctor notes, prescriptions, lab results
- Admin ability to add new provider accounts through the UI (the API supports it via `/api/auth/register`, just no button wired up yet)
- Ride requests don't have a real driver-matching system — they're logged and visible to admins, but there's no dispatch logic
- Offline handling / PWA support
- Production-grade rate limiting on any endpoint, including Mama AI

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
| PATCH  | /api/users/me                      | any logged-in | Update your own profile (e.g. due_date) |
| GET    | /api/appointments                  | any logged-in | List your scoped appointments     |
| POST   | /api/appointments                  | mother        | Book an appointment               |
| PATCH  | /api/appointments/:id/assign        | admin         | Assign a provider                 |
| PATCH  | /api/appointments/:id/status        | admin/provider| Change status                     |
| GET    | /api/messages/conversations         | any logged-in | Your conversation list            |
| GET    | /api/messages/thread/:userId        | any logged-in | Message thread with a user        |
| POST   | /api/messages                      | any logged-in | Send a message                    |
| GET    | /api/rides                         | any logged-in | Your ride requests (or all, if admin) |
| POST   | /api/rides                         | mother        | Request a ride                    |
| PATCH  | /api/rides/:id/status                | admin         | Update ride status                |
| POST   | /api/mama-ai                       | any logged-in | Chat with Mama AI                 |
| GET    | /api/notifications                 | any logged-in | Your notifications                |
| PATCH  | /api/notifications/:id/read         | any logged-in | Mark one as read                  |
| GET    | /api/complaints                    | any logged-in | Your complaints (or all, if admin)|
| POST   | /api/complaints                    | any logged-in | File a complaint                  |
| PATCH  | /api/complaints/:id/status           | admin         | Resolve/review a complaint        |
| GET    | /api/stats/admin                   | admin         | Dashboard stat cards               |
| GET    | /api/stats/doctor                  | doctor/health | Dashboard stat cards               |
| GET    | /api/stats/mother                  | mother        | Dashboard stat cards               |

## Docker (fallback if a local Postgres install is giving you trouble)

If installing/running Postgres directly on your machine is unreliable, Docker sidesteps that entirely — it runs a clean Postgres instance in a container instead. This project includes a `docker-compose.yml` covering two ways to use it.

**Prerequisite:** install Docker Desktop (Mac/Windows) or Docker Engine (Linux) from https://www.docker.com/products/docker-desktop/ if you don't have it.

### Option A: Just run Postgres in Docker, keep running the app with `npm start`

This is the minimal fix if only your Postgres install is the problem:

```
docker compose up -d db
```

This starts a Postgres 16 container on `localhost:5432` with a persistent volume (data survives container restarts). Then set your `.env` to:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mama_uhai
```
and run the app as normal:
```
npm start
```

To stop it: `docker compose stop db`. To wipe its data and start fresh: `docker compose down -v`.

### Option B: Run the whole app (Node + Postgres) in Docker together

```
docker compose up --build
```

This builds the app image from the included `Dockerfile` and starts both the app and database as containers that talk to each other automatically — no local Node.js or Postgres installation needed at all. Visit **http://localhost:4000** once it's up.

To stop: `Ctrl+C`, then `docker compose down` (add `-v` to also delete the database volume).

### Note on Render

Render's native Node.js runtime (what we've been using — "Build Command: npm install", "Start Command: npm start") does **not** use this Dockerfile; that's a separate path and doesn't require Docker knowledge to deploy successfully. The Dockerfile here is for your **local machine** as a fallback, or for advanced use if you ever want to switch your Render web service to "Docker" as its runtime instead of "Node" — under your service's Settings, you can change the runtime and Render will build from this `Dockerfile` instead. This isn't necessary for the app to work; it's an alternative path if the native Node build ever gives you trouble.

**A note on testing:** this Dockerfile and Compose setup follow standard, well-established patterns for Node + Postgres, but I wasn't able to run an actual Docker build in the environment I built this in (no Docker daemon available there). If anything doesn't behave as described, let me know the exact error and I'll fix it.

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

