# Unified LINE OA Inbox

Aggregate multiple LINE Official Accounts into one inbox where agents reply to customers. 1:1 chats only; no groups, automation, chatbot, or omnichannel.

## Architecture

- **Webhook ingest**: `POST /api/webhooks/line/:oaId` — verify LINE signature, store event, enqueue job, return 200.
- **Worker**: Consumes Redis queue, upserts contact/conversation/message, updates inbox read model, broadcasts realtime.
- **Inbox API**: Session-based auth, RBAC (admin / agent). Admin sees all threads; agent sees only assigned.
- **Realtime**: Socket.IO rooms `agent:{id}` and `conversation:{id}`; new messages broadcast to assigned agent.

## Deployment (Render / Docker)

The system is designed to run only in the cloud. Use a **managed PostgreSQL** and **managed Redis** (e.g. Render PostgreSQL, Render Redis or Upstash).

### 1. Database and Redis

- Create a **PostgreSQL** database and note the connection URL.
- Create a **Redis** instance and note the connection URL.

### 2. Run migrations

Run Prisma migrations against your database from a one-off job or from your API’s first start:

- Set `DATABASE_URL` to your PostgreSQL URL.
- From the **backend** directory (in Docker or in a build step), run:
  - `npx prisma migrate deploy`
  - `npx prisma generate` (if not already done in build)

If you run migrations inside the API container, add a startup script that runs `prisma migrate deploy` before `node dist/main.js`.

### 3. Environment variables

**API (backend)**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `REDIS_URL` | Yes | Redis connection URL |
| `SESSION_SECRET` | Yes | Secret for session signing (e.g. long random string) |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM key (e.g. 32+ character secret) |
| `PORT` | No | Render sets this (default `10000`). App binds to `0.0.0.0:PORT`. |

Browser does not call the API directly; the Next.js frontend proxies `/api/*` to the backend via Private Network, so CORS for the browser is not needed.

**Worker (same codebase as backend, different CMD)**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Same PostgreSQL URL |
| `REDIS_URL` | Yes | Same Redis URL |

**Frontend (same-origin proxy)**

| Variable | Required | Description |
|----------|----------|-------------|
| `INTERNAL_API_URL` | Yes | Backend URL via Private Network (e.g. `http://unified-line-oa-inbox:10000`). The Next.js server proxies all `/api/*` requests to this URL; the browser only talks to the frontend domain, so session cookies are first-party. |

### 4. Build and run with Docker

**API**

- Build: from repo root,  
  `docker build -f backend/Dockerfile -t unified-inbox-api ./backend`
- Run:  
  `docker run -p 3001:3001 -e DATABASE_URL=... -e REDIS_URL=... -e SESSION_SECRET=... -e ENCRYPTION_KEY=... unified-inbox-api`

**Worker**

- Build:  
  `docker build -f backend/Dockerfile.worker -t unified-inbox-worker ./backend`
- Run:  
  `docker run -e DATABASE_URL=... -e REDIS_URL=... unified-inbox-worker`

**Frontend**

- Build:  
  `docker build -f frontend/Dockerfile -t unified-inbox-frontend ./frontend`
- Run:  
  `docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://your-api.onrender.com unified-inbox-frontend`

### 5. Render setup

- **Web Service (API)**: Connect repo, root directory `backend`, Dockerfile path `backend/Dockerfile`. Set env vars; add start command if you run migrations on boot: `npx prisma migrate deploy && node dist/main.js`.
- **Background Worker**: Same repo, root `backend`, Dockerfile path `backend/Dockerfile.worker`. Same `DATABASE_URL` and `REDIS_URL`.
- **Web Service (Frontend)**: Root `frontend`, Dockerfile `frontend/Dockerfile`. Set `INTERNAL_API_URL` to your API’s Private Network URL (e.g. `http://<api-service-name>:10000`).

### 6. Seed first admin (optional)

From the **backend** directory (e.g. in a one-off Docker container or Render Shell), set `DATABASE_URL` and run:

```bash
npx prisma db seed
```

Optional env: `SEED_ADMIN_NAME` (default `admin`), `SEED_ADMIN_PASSWORD` (default `admin123`). This creates one admin agent if none exists.

**OA accounts**: Insert into `oa_accounts` with encrypted token and secret (use your app’s `ENCRYPTION_KEY`), or add an admin UI later to register OAs.

### 7. LINE webhook

- For each LINE Official Account, set the webhook URL to:  
  `https://<your-api-host>/api/webhooks/line/<oa_id>`  
  where `oa_id` is the `id` of the row in `oa_accounts`.
- Ensure `channel_secret` and `channel_access_token` are stored encrypted in `oa_accounts` (e.g. via an admin UI or script using `ENCRYPTION_KEY`).

## Retention

A daily job (repeatable BullMQ job) runs at midnight and deletes messages older than 6 months. The worker process handles this job.

## Optional: message table partitioning

For very high volume, you can partition `messages` by `sent_at` (e.g. monthly). See `backend/prisma/scripts/optional_message_partitions.sql`. This requires schema changes (e.g. PK including `sent_at`) and is not applied by default.

## Project layout

- `backend/` — NestJS + Fastify API, Prisma, Redis queue, Socket.IO gateway.
- `frontend/` — Next.js App Router UI (login, inbox, conversation, reply, assign).
- `backend/Dockerfile` — API image.
- `backend/Dockerfile.worker` — Worker image (same codebase, different entrypoint).
