# Juragan

[![CI](https://github.com/<owner>/juragan/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/juragan/actions/workflows/ci.yml)

**Asisten bisnis pribadi untuk owner UMKM & bisnis menengah Indonesia.** Self-hosted, open source, lewat Telegram.

Juragan adalah AI agent yang:
- 📝 **Catat** — notes, transaksi (pemasukan/pengeluaran), produk/stok, kontak customer & supplier, invoice & piutang.
- ⏰ **Ingetin** — pengingat otomatis ke Telegram pas jatuh tempo ("ingetin besok jam 9 telepon Pak Budi" → besok 09:00 WIB bot beneran chat).
- 📊 **Laporin** — ringkasan harian, alert stok menipis, list invoice overdue.
- 🧠 **Pakai skills** — resep kerja siap pakai (`daily-checkin`, `customer-followup`, `price-calculation`) yang bikin agent konsisten di tugas rutin.
- 💬 **Jawab lewat Telegram** — percakapan natural Bahasa Indonesia, workflow owner terbiasa.

Owner masuk ke dashboard web sekali untuk setup (OpenRouter API key, Telegram bot dari @BotFather), setelah itu interaksi harian lewat Telegram.

---

## Quick start

Prasyarat: **Node 20+**, **pnpm 10+**, **Docker** (untuk Redis).

```bash
# 1. Clone + install + start Redis
git clone https://github.com/<you>/juragan
cd juragan
pnpm setup          # pnpm i && cp .env.example .env && docker compose up -d redis

# 2. Jalankan semua apps (api + worker + web dashboard)
pnpm dev
```

Buka **http://localhost:5173** untuk dashboard. Di tab **Settings**:
1. Paste OpenRouter API key (dapat dari https://openrouter.ai/keys).
2. Buat bot Telegram di [@BotFather](https://t.me/BotFather) → paste token → **Test connection**.
3. DM [@userinfobot](https://t.me/userinfobot) → paste Chat ID owner (buat target push pengingat).
4. **Simpan** → restart API server (`pnpm --filter @juragan/api dev`).
5. Buka bot kamu di Telegram → mulai chat.

---

## Architecture

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  apps/web    │──▶│  apps/api    │──▶│ apps/worker  │
│  (Vite+React │   │  (Mastra     │   │  (BullMQ     │
│   dashboard) │   │   agent)     │   │   consumer)  │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                   │
       ▼                  ▼                   ▼
┌────────────────────────────────────────────────────┐
│         LibSQL (shared file)  +  Redis             │
└────────────────────────────────────────────────────┘
                      │
                      ▼
               ┌──────────────┐
               │   Telegram   │
               │   Bot API    │
               └──────────────┘
```

- **`apps/api`** — [Mastra 1.25](https://mastra.ai) agent server. 15 business tools, Telegram channel (polling mode, no public URL needed), custom HTTP routes for dashboard, in-process reminder fallback.
- **`apps/worker`** — BullMQ consumer. Exact-time reminder dispatch, room for future async jobs (daily summaries, WA sessions, etc.).
- **`apps/web`** — Vite + React + Tailwind 4 dashboard. Stats, workspace file browser, settings.
- **`packages/shared`** — domain types (`TenantId`, `Role`, `Channel`), `formatIDR`, cross-package constants.
- **`packages/queue`** — BullMQ queue definitions, connection factory, job types.

**Data:**
- LibSQL file at `apps/api/data/juragan.db` — all business tables (`notes`, `transactions`, `reminders`, `products`, `contacts`, `invoices`, `settings`) + Mastra's internal tables (prefixed `mastra_*`).
- Redis at `:6379` — BullMQ scheduler only. Not used as primary storage.
- Workspace files at `apps/api/data/workspaces/{tenantId}/owner/` — owner drops files here; agent reads via skills.

---

## Environment variables

Copy `.env.example` to `.env` at the repo root. Minimum:

| Variable | Required | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | LLM provider. Can also be saved via dashboard. |
| `TELEGRAM_BOT_TOKEN` | Yes | From [@BotFather](https://t.me/BotFather). Can be saved via dashboard. |
| `TELEGRAM_OWNER_CHAT_ID` | Yes (for reminders) | From [@userinfobot](https://t.me/userinfobot). Target for push notifications. |
| `DATABASE_URL` | Optional | Default `file:./data/juragan.db`. Swap to `libsql://...` for [Turso](https://turso.tech). |
| `REDIS_URL` | Optional | Default `redis://localhost:6379`. |
| `DEFAULT_TENANT_ID` | Optional | Default `default`. Single-tenant for now; multi-tenant seams ready. |
| `DASHBOARD_SECRET` | **Yes (production)** | Secret for protecting `/custom/*` API routes + dashboard. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `PORT` | Optional | Default `4111`. API server listen port. |

Full list with comments in `.env.example`.

---

## Developer commands

From the repo root (Turborepo orchestrates):

```bash
pnpm dev              # start api + worker + web in parallel (needs Redis up)
pnpm build            # build all apps
pnpm test             # run all tests (vitest)
pnpm lint             # Biome check
pnpm format           # Biome format --write
pnpm check-types      # tsc --noEmit across workspaces
```

Filter to a single package:

```bash
pnpm --filter @juragan/api dev
pnpm --filter @juragan/worker dev
pnpm --filter @juragan/web dev
```

Start Redis locally:

```bash
docker compose up -d redis
```

---

## Self-hosting (production)

### Docker (recommended)

Production uses Docker Compose with all three apps containerized:

```bash
# 1. Build the web dashboard
pnpm --filter @juragan/web build

# 2. Start everything (API + worker + web + Redis)
cp .env.production.example .env.production
# Edit .env.production — fill in OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN, DASHBOARD_SECRET
docker compose -f docker-compose.prod.yml --env-file .env.production up
```

The API server starts on port **4111**, the web dashboard on **5173** (nginx).

### Reverse proxy setup

Both services must sit behind a TLS-terminating reverse proxy. Example Nginx:

```nginx
# API server — /api/* and /custom/*
location /api/ {
    proxy_pass http://localhost:4111;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
location /custom/ {
    proxy_pass http://localhost:4111;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Authorization $http_authorization; # forward the Bearer token
}

# Web dashboard
location / {
    proxy_pass http://localhost:5173;
}
```

Caddy (automatic TLS):

```caddy
api.yourdomain.com {
    reverse_proxy localhost:4111
}
dashboard.yourdomain.com {
    reverse_proxy localhost:5173
}
```

### Health checks

- API: `GET /health` → `{"status":"ok"}` (Mastra built-in)
- Worker: BullMQ worker lifecycle — if the container is running, it's healthy
- Redis: `docker compose healthcheck` (already configured in `docker-compose.prod.yml`)

### Reminder architecture

Reminders are dispatched via two mechanisms:

1. **BullMQ worker** (primary) — `apps/worker` consumes `reminder-fire` queue jobs at exact time. Requires Redis.
2. **In-process fallback** (secondary) — `apps/api` runs a 60-second `setInterval` loop that also fires due reminders. Used when Redis is down.

Both write to the same `reminders` table. The BullMQ job sets `done=1` idempotently (conditional `UPDATE WHERE done=0`).

### Securing your deployment

1. **Set `DASHBOARD_SECRET`** before exposing publicly. Without it, unauthenticated callers can hit `/custom/*` routes.
2. **Never store secrets in the database** in production — use env vars. The DB storage is useful for initial setup only.
3. **Protect the data directory** — `apps/api/data/` contains `juragan.db` with all business data.
4. **Keep Redis private** — don't expose port 6379 publicly. The Docker compose already handles this.

---

## Adding an agent tool

Tools live in `apps/api/src/mastra/tools/*.ts`. Each is a factory that takes `{ db, tenantId }` so tests can pass an in-memory libsql instance.

Minimal example:

```ts
// apps/api/src/mastra/tools/myfeature.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../db/client.js';

export function createMyTools({ db, tenantId }: { db: Db; tenantId: string }) {
  const myAction = createTool({
    id: 'my-action',
    description: 'Indonesian description — tells the LLM when to use this',
    inputSchema: z.object({ /* ... */ }),
    outputSchema: z.object({ /* ... */ }),
    execute: async (input) => { /* ... */ },
  });
  return { myAction };
}
```

Wire into `apps/api/src/mastra/agents/juragan.ts`, add a test in `apps/api/tests/tools/`, done.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contributor workflow.

---

## Roadmap

Current state is feature-rich for single-owner self-hosted use. See [`CHANGELOG.md`](./CHANGELOG.md) for shipped work. Planned hardening:

- **Auth** — admin login + API key for dashboard & custom routes (Supabase/MinIO-inspired). Today the dashboard is wide open; don't expose port 4111 publicly.
- **Secret encryption at rest** — OpenRouter/Telegram tokens currently plaintext in libsql; libsodium encryption with `ENCRYPTION_KEY` coming.
- **Full multi-tenancy** — tenant-scoped queries are already in place, need request-context wiring + sign-up flow.
- **WhatsApp channel** — customer-facing bot via Baileys (owner controls via Telegram, customers reach via WA).
- **Supervisor agent split** — when tool count outgrows single-agent selection.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to pick up a roadmap item.

---

## Security

`DASHBOARD_SECRET` protects all `/custom/*` API routes. **Set it in production.** Without it, routes are open — do not expose port 4111 publicly.

The existing `OPENROUTER_API_KEY` and `TELEGRAM_BOT_TOKEN` are still stored plaintext in LibSQL. For production, prefer environment variables — the agent reads env first, DB second.

Known limitations documented in [SECURITY.md](./SECURITY.md).

---

## License

[MIT](./LICENSE). Free to self-host, fork, modify, commercialize.

---

## Credits

- Built on [Mastra](https://mastra.ai) agent framework.
- Telegram adapter: [`@chat-adapter/telegram`](https://chat-sdk.dev/adapters/telegram).
- Queue: [BullMQ](https://bullmq.io).
