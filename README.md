# ReachInbox: Email Job Scheduler

A full-stack email scheduler: an Express + BullMQ backend that stores campaigns in Postgres, schedules each email as a **delayed BullMQ job** in Redis (no cron), sends through **Ethereal SMTP**, and indexes emails in **Elasticsearch**. The React dashboard lets you log in with Google, compose campaigns from a CSV lead list, and watch emails move from *Scheduled* to *Sent*.

```
reachinbox-scheduler/
├── docker-compose.yml     Postgres 16, Redis 7 (AOF on), Elasticsearch 8
├── sample-leads.csv       Example lead list for the compose upload
├── backend/               Express API + BullMQ worker (TypeScript, Prisma)
└── frontend/              React + Vite + Tailwind (TypeScript)
```

---

## 1. Running it

### Prerequisites
- Node.js 20+ and Docker

### Infra
```bash
docker compose up -d        # Postgres :5433, Redis :6380, Elasticsearch :9200
```
The host ports are 5433/6380 so they don't clash with a local Postgres/Redis install.

### Backend
```bash
cd backend
cp .env.example .env        # then fill in the values below
npm install
npx prisma migrate deploy   # creates the tables
npm run dev                 # starts the API (:4000) AND the worker, with reload
```
You can also run the two processes separately (and start several workers):
```bash
npm run dev:api
npm run dev:worker          # run this in 2+ terminals to see multi-worker safety
```
Production build: `npm run build && npm start` / `npm run start:worker`.

Once it is running:
- API: `http://localhost:4000/api`
- **Bull Board** (live queue dashboard): `http://localhost:4000/admin/queues`

### Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```
Vite proxies `/api` to `localhost:4000`, so the session cookie is same-origin.

---

## 2. Configuration

### Ethereal Email
You don't need to do anything. If `ETHEREAL_ACCOUNTS` is empty, the API calls `nodemailer.createTestAccount()` on first boot, creates `ETHEREAL_SENDER_COUNT` (default 3) sender accounts, and stores them in the `Sender` table, so they are reused after restarts. The credentials are printed in the API log. Log in at <https://ethereal.email> with them to see the delivered messages. Each sent email also stores its Ethereal **preview URL**, which the email detail page links to.

To use your own accounts, set `ETHEREAL_ACCOUNTS=user1@ethereal.email:pass1,user2@ethereal.email:pass2`. This only applies while the `Sender` table is empty.

### Google OAuth
1. Google Cloud Console → *APIs & Services → Credentials → Create OAuth client ID → Web application*.
2. Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`.
3. Put the client id/secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### Slack OAuth
1. <https://api.slack.com/apps> → *Create New App* → *OAuth & Permissions*.
2. Add the bot scope **`incoming-webhook`**.
3. Slack only accepts **HTTPS** redirect URLs, so expose the backend with a tunnel: `ngrok http 4000`. Then add `https://<id>.ngrok-free.app/api/slack/oauth/callback` as the redirect URL and set the same value as `SLACK_REDIRECT_URI`.
4. Set `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.

The callback identifies the user by a signed, 10-minute `state` token, not the session cookie, so it works even though Slack redirects to the ngrok host.

### All throughput settings (`backend/.env`)
| Variable | Default | Meaning |
|---|---|---|
| `WORKER_CONCURRENCY` | 5 | Jobs processed in parallel per worker process |
| `MIN_DELAY_BETWEEN_SENDS_MS` | 2000 | **Minimum 2 s between two sends from the same sender** |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | 200 | Hard hourly cap per sender (shared by all campaigns) |
| `QUEUE_LIMITER_MAX` / `QUEUE_LIMITER_DURATION_MS` | 50 / 1000 | Global BullMQ limiter: ≤50 jobs/s across all workers (counts deferrals too) |
| `RATE_LIMIT_MAX_LOOKAHEAD_HOURS` | 720 | How far ahead to look for a free hour window |
| `JOB_ATTEMPTS` / `JOB_BACKOFF_MS` | 3 / 5000 | SMTP retry policy (exponential backoff) |

The compose form's **Hourly limit** is a *per-campaign* limit. It can only lower the sender's cap, never raise it. The form's **Delay between 2 emails** spaces that campaign's emails out when they are scheduled.

---

## 3. Architecture

```
 React (Vite)  ──/api──►  Express API ──► Postgres (source of truth)
                               │  └────► Elasticsearch (search index)
                               ▼
                         BullMQ queue "email-send"  (Redis, AOF)
                               ▼
                 Worker(s) ─ rate limiter (Redis Lua) ─► Ethereal SMTP
                               └──► Slack webhook when a limit is hit
```

### How scheduling works
1. `POST /api/campaigns` validates the input (zod), dedupes recipients, and in **one transaction** inserts a `Campaign` row plus one `Email` row per recipient. Email *i* gets `scheduledAt = startAt + i × delay`.
2. For each email it adds a BullMQ job with `delay = scheduledAt − now` and **`jobId = email-<emailId>`**. Jobs are added with `addBulk` in chunks of 500, so 1,000+ recipients take one request.
3. BullMQ keeps the job in Redis's *delayed* set and promotes it to *waiting* when it is due. **There is no cron or polling loop.**
4. The worker loads the row, applies the rate limits (below), claims the row, sends, and marks it `SENT` with `sentAt` and the preview URL. Every status change is re-indexed in Elasticsearch.

### Persistence across restarts and no duplicates
- **Jobs live in Redis, not in process memory.** Redis runs with AOF (`appendfsync everysec`), so stopping the API/worker (or even Redis) keeps every delayed job with its original timestamp. When the worker starts again, BullMQ promotes whatever is due, and future jobs keep waiting until their time. Nothing restarts from the beginning.
- **Reconciliation on worker start** (`queue/reconcile.ts`): Postgres is the source of truth. Every `SCHEDULED`/`SENDING` row is checked for a live job, and missing ones are re-enqueued. This covers a lost Redis, or a crash between the DB commit and enqueueing. Because job ids are deterministic, re-adding an existing job is a no-op.
- **Idempotency, in layers:**
  1. `Idempotency-Key` header on campaign create, backed by a unique index on `(userId, idempotencyKey)`. A double-click or retried request returns the existing campaign.
  2. `jobId = email-<id>`: BullMQ refuses a second job with the same id.
  3. The worker exits early if the row is already `SENT`/`FAILED`.
  4. The row is **claimed with a conditional update** (`UPDATE … SET status='SENDING' WHERE status IN ('SCHEDULED','SENDING')`) before sending.
  5. Each message has a deterministic `Message-ID: <emailId@reachinbox.local>`.
- Graceful shutdown (`SIGINT`/`SIGTERM`) calls `worker.close()`, which lets in-flight sends finish. A job that was active when a process was killed is recovered by BullMQ's stalled-job check.

### Rate limiting and concurrency
All of this state lives in **Redis and is updated by Lua scripts**, so it is atomic across any number of workers and machines. Nothing is counted in memory.

**Hourly limit (per sender + per campaign)**, in `queue/rateLimiter.ts`:
- Counters are keyed by clock hour: `rl:sender:<senderId>:<hourWindow>` and `rl:campaign:<campaignId>:<hourWindow>`.
- One Lua script walks forward from the current hour, finds the **first window where both counters are under their limits**, increments both, and returns that window. The reservation is saved in the job data, so a job is never counted twice.
- If that window is the current hour, the email is sent now. If not, the job is **moved back to delayed** (`job.moveToDelayed` + `DelayedError`) to the start of the reserved window, offset by `position × MIN_DELAY`. Jobs are **never dropped or failed** for rate limiting. Deferral doesn't use up a retry attempt, the row's `scheduledAt`/`deferredCount` are updated, and the UI shows a *Rate limited* tag.
- Because every job reserves the earliest free slot in order, overflow fills later hours in sequence (hour 1 gets emails 201-400, and so on) instead of piling up at the next hour boundary. This keeps the original order as much as possible.

**Minimum delay between sends**: a second Lua script keeps a per-sender "next free slot" timestamp. Each send reserves `max(now, nextFree)` and pushes `nextFree` forward by `MIN_DELAY_BETWEEN_SENDS_MS`. Short waits are slept inside the worker. Waits over 15 s are handed back to Redis as a delayed job, so they don't hold a concurrency slot.

**Concurrency**: `WORKER_CONCURRENCY` sets how many jobs each worker runs in parallel. Parallel jobs are safe because of the atomic Redis reservations and the conditional DB claim. With several senders, their emails really do go out in parallel. A single sender is serialised to one send per 2 s. The BullMQ `limiter` is a global ceiling across all workers on top of this.

**Behaviour under load (1,000+ emails at the same time):**
- The API does one transaction, bulk-enqueues in chunks of 500, and bulk-indexes in Elasticsearch.
- Suppose the limit is 200/h per sender. The first 200 jobs get the current hour, the next 200 reserve the next hour, and so on. Each hour's batch then drains at one send per 2 s per sender (≈7 min for 200).
- Try it: `npm run load-test -- --count 1000 --hourly 50` (backend folder). Then watch Bull Board and the Scheduled tab.

### Slack notification on rate limit
- *Connect Slack* in the sidebar → `/api/slack/connect` returns the Slack authorize URL → Slack → `/api/slack/oauth/callback` exchanges the code (`oauth.v2.access`) and stores the incoming-webhook URL and token per user (`SlackConnection`). A confirmation message is posted right away.
- A message is sent the moment a limit is reached: when a send fills the limit, or when a job gets deferred. It is deduped per *(limit, hour window, user)* with `SET NX`, so 5 parallel workers still produce one message.
- The connection is read from the DB on every notification. Not connected means the notification is skipped (no error), and connecting or reconnecting takes effect immediately without a redeploy. *Disconnect* revokes the token (`auth.revoke`) and deletes the row. There is also a *Test* button.

### Search (Elasticsearch)
Index `emails` holds `toEmail` (text + keyword), `subject`, `body`, `status`, `userId`, sender, and dates. The dashboard search box calls `GET /api/emails?tab=…&q=…`. That runs a fuzzy `multi_match`, a `phrase_prefix` for as-you-type matching, and a wildcard on the address, filtered by user and tab status. Rows are then loaded from Postgres, so what you see is always current. If Elasticsearch is down, search falls back to a Postgres `ILIKE` query and sending is unaffected.

---

## 4. API

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/google` → `/callback` | Google OAuth login (sets an httpOnly JWT cookie) |
| GET | `/api/auth/me` · POST `/api/auth/logout` | Current user / logout |
| GET | `/api/senders` | Available sender accounts |
| POST | `/api/campaigns` | Schedule a campaign (`Idempotency-Key` header supported) |
| GET | `/api/emails?tab=scheduled\|sent&q=&page=&limit=` | List / search |
| GET | `/api/emails/stats` · `/api/emails/:id` | Counters / detail |
| GET | `/api/slack/status` · `/connect` · `/oauth/callback` | Slack OAuth |
| DELETE | `/api/slack` · POST `/api/slack/test` | Disconnect / test message |
| GET | `/admin/queues` | Bull Board |

Example body for `POST /api/campaigns`:
```json
{
  "senderId": "<uuid from /api/senders>",
  "subject": "Quick question",
  "body": "Hi,\n\n...",
  "recipients": ["a@example.com", "b@example.com"],
  "startAt": "2026-10-01T10:00:00.000Z",
  "delayBetweenSeconds": 5,
  "hourlyLimit": 100
}
```

---

## 5. Features implemented

**Backend**
- [x] Express + TypeScript, Prisma + PostgreSQL
- [x] Scheduling with BullMQ delayed jobs only, no cron
- [x] Ethereal SMTP with multiple senders (auto-provisioned), preview URL per email
- [x] Survives restarts: Redis AOF, deterministic job ids, and startup reconciliation from Postgres
- [x] Idempotency at the request, job, row-claim, and Message-ID levels
- [x] Configurable worker concurrency; safe parallel processing
- [x] Minimum delay between sends (per sender, Redis-backed) plus a global BullMQ limiter
- [x] Hourly limits per sender (env) and per campaign (form), with Redis Lua counters and deferral to the next free hour, preserving order
- [x] Slack OAuth, a live notification on rate-limit hit, disconnect/reconnect without redeploy
- [x] Elasticsearch indexing and search (with Postgres fallback)
- [x] Bull Board live queue dashboard
- [x] Load-test script (1,000+ emails)

**Frontend**
- [x] Real Google OAuth login; header shows name, email and avatar; logout
- [x] Dashboard with Scheduled and Sent tabs (live counts), Compose button
- [x] Compose: sender, recipients (type or paste, or CSV/TXT upload with detected-address count), subject, rich-text body (toolbar: undo/redo, text size, bold/italic/underline, alignment, lists, indent, quote, strikethrough), attachments (up to 5 files, 10 MB), delay between emails, hourly limit, start time (Send Later popover with presets)
- [x] Scheduled list: email, subject, scheduled time, status; Sent list: email, subject, sent time, sent/failed
- [x] Loading skeletons, empty states, error states with retry, toasts
- [x] Search (Elasticsearch), status filter (Sent / Failed, Rate limited), pagination, auto-refresh every 5 s, email detail page with rendered body, attachment cards and Ethereal preview link
- [x] Reusable UI components (Button, Field, Modal, Avatar, StatusBadge, EmptyState, Spinner) and typed API layer

---

## 6. Assumptions, shortcuts and trade-offs
- **Hour windows are clock hours (UTC)**, not a rolling 60 minutes. This makes the "next available hour window" requirement well defined and keeps counters simple.
- **At-least-once at the SMTP boundary.** If a process dies *after* the SMTP server accepts a message but *before* the row is marked `SENT`, the recovered job resends it. This is the one gap no system can close without transactional SMTP. The deterministic `Message-ID` lets receivers dedupe. Every other path is exactly-once.
- When a job is deferred for rate limiting, its reserved slot in the later window stays counted, even if the job is later cancelled or the process is down past that hour. In that case it reserves again, and the old slot just goes unused.
- The rate-limit Lua script builds its keys at runtime. That's fine on a single Redis node. On Redis Cluster the keys would need a shared hash tag.
- Senders are a shared pool (the Ethereal accounts), and the per-sender limit applies across all users. Slack alerts go to the owner of the campaign that hit the limit.
- Rich-text bodies are HTML. The server sanitises them (`sanitize-html` allow-list) before storing or sending, and the dashboard sanitises again (DOMPurify) before rendering. Plain-text bodies sent through the API are escaped and keep their line breaks. There is no per-recipient templating.
- Attachments are stored once per campaign in Postgres (`Attachment` table, max 5 files / 10 MB) and sent with every email of that campaign. Object storage (S3) would be the next step at larger scale.
- The login page shows the email/password form from the Figma, but only Google sign-in is implemented, as the assignment requires.
- The UI follows the provided Figma: login card, sidebar (logo, user card, Compose, Core: Scheduled/Sent), list rows with time/status pills, Gmail-style email detail, and the compose page with the Send Later popover. The sidebar also has a small Slack card and a Bull Board link, which the assignment requires but the Figma doesn't show.
- Bull Board has optional basic auth (`BULL_BOARD_USER`/`PASS`). It is open by default for the demo.
