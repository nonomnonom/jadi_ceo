# Juragan — AI Business Agent for Indonesian Entrepreneurs

Personal AI agent for Indonesian business owners. Handles Telegram + WhatsApp customer conversations, manages orders/inventory/invoices, and runs automated workflows.

## Quick Start

```bash
cd Juragan
pnpm install
cp .env.example .env          # then edit .env with your API keys
docker compose up -d redis
pnpm dev
```

## Architecture

```
juragan/
├── apps/
│   ├── api/          # Mastra server — agent logic, channels, workflows
│   ├── web/          # React + Vite dashboard (WIP)
│   └── worker/       # BullMQ background job processor
├── packages/
│   ├── shared/       # Zod schemas, types, utilities ( TenantId, formatIDR )
│   └── queue/        # BullMQ job definitions shared across api/worker
└── skills/           # Agent skill definitions (prompt templates + tool sequences)
```

**Runtime dependencies:** Node ≥20, Redis, LibSQL (Turso or local file)

## Core Concepts

### Supervisor Pattern

`ownerSupervisor` is the main agent — it decides whether to handle a request directly or delegate to a domain sub-agent:

| Sub-Agent | Responsibility |
|-----------|---------------|
| `noteAgent` | Notes and ideas |
| `financeAgent` | Income/expense logging, daily summary |
| `catalogAgent` | Products, pricing, stock |
| `contactAgent` | Customer and supplier contacts |
| `invoiceAgent` | Invoices and receivables |

### Channels

| Channel | Implementation | Notes |
|---------|---------------|-------|
| **Telegram** | Mastra Channel (`@chat-adapter/telegram` v4) | `mode: "polling"` for local dev. Bot token via env or DB-stored. |
| **WhatsApp** | Baileys (direct, NOT a Mastra Channel) | QR code login, webhook-free. Owned by `whatsapp-manager.ts`. |

### Skills

Skills are prompt templates with ordered tool sequences. Located in `apps/api/skills/`:

| Skill | Trigger | What it does |
|-------|---------|--------------|
| `daily-checkin` | "check-in pagi", "gimana hari ini" | Morning summary: income, overdue invoices, low stock, upcoming reminders |
| `price-calculation` | "hitung harga", "kalkulasi" | Calculates selling price with margin, shipping, platform fees |
| `customer-followup` | Owner-triggered workflow | Tracks overdue invoices, sends WA reminders via BullMQ |
| `invoice-reminder` | Scheduled workflow | Auto-sends payment reminder to customers |
| `supplier-order` | "pesan supplier", "order ulang" | Creates purchase order for restocking |
| `stock-opname` | "stock opname", "opname" | Guides physical inventory count |
| `expense-claim` | "claim expense", "lamparan" | Records expense with category and receipt note |
| `wa-blast` | "blast wa", "kirim massal" | Sends broadcast message to customer list |

### Memory

Mastra Memory stores conversation history and is post-processed by the **Dream Scheduler** (`dream-scheduler.ts`) — a background process that consolidates memories for better context on subsequent conversations. Memory persists to LibSQL via `LibSQLStore`.

### Workspace

Each tenant gets a `LocalFilesystem` workspace at `data/workspaces/{tenantId}/owner/`. Design system files (brand CSS/JSON) are initialized per workspace. Filesystem tools have safety guards: delete/edit disabled by default, write requires approval and read-before-write.

### Workflows

Three Mastra workflows orchestrated with `createWorkflow` + `createStep`:

- **`orderApproval`** — New customer orders are held for owner approval via Telegram
- **`restock`** — Low-stock trigger → generates purchase order draft
- **`customerFollowup`** — Tracks overdue invoices and triggers BullMQ jobs for WA reminders

## Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `OPENROUTER_API_KEY` | env or `settings` table | AI model API key |
| `TELEGRAM_BOT_TOKEN` | env or `settings` table | Telegram bot token |
| `TELEGRAM_OWNER_CHAT_ID` | env or `settings` table | Owner Telegram chat ID for notifications |
| `DATABASE_URL` | env | LibSQL connection string |
| `REDIS_URL` | env | BullMQ Redis connection |
| `DEFAULT_TENANT_ID` | env, default `"default"` | Tenant ID for single-tenant mode |

**Note:** API keys stored in the `settings` table are promoted into `process.env` at bootstrap time (before any module reads them). See `apps/api/src/bootstrap.ts`.

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/bootstrap.ts` | Schema init + credential promotion from DB → env |
| `apps/api/src/mastra/index.ts` | Mastra instance — agents, workflows, storage, channels |
| `apps/api/src/mastra/agents/owner-supervisor.ts` | Main agent + all tools registration |
| `apps/api/src/mastra/agents/customer/index.ts` | WhatsApp customer-facing agent |
| `apps/api/src/channels/whatsapp-handler.ts` | Baileys message handler for WA |
| `apps/api/src/channels/whatsapp-manager.ts` | WA session lifecycle (QR, auth, reconnect) |
| `apps/api/src/mastra/workspace.ts` | Per-tenant workspace + filesystem tool config |
| `apps/api/src/db/schema.ts` | LibSQL schema (products, contacts, invoices, orders, settings) |
| `apps/api/src/reminders/executor.ts` | Polling reminder scheduler |
| `apps/api/src/scheduler/dream-scheduler.ts` | Memory consolidation scheduler |
| `apps/api/src/workflows/` | Mastra workflow definitions |
| `packages/shared/src/index.ts` | `TenantId`, `formatIDR`, `Role`, `Channel` types |
| `packages/queue/src/index.ts` | BullMQ job type definitions |

## Slash Commands (Owner via Telegram)

| Command | Description |
|---------|-------------|
| `/order list\|approve\|reject` | Manage customer orders |
| `/customer orders\|view\|analytics\|override` | Customer data and conversation |
| `/customer-agent status\|enable\|disable\|view-all` | Toggle WhatsApp auto-reply |
| `/model [provider/model]\|list` | Switch AI model or view supported list |
| `/memory search\|read\|stats` | Search Mastra memory |
| `/skill [name]` | Trigger a skill manually |
| `/payment link\|cancel\|simulate` | Generate payment links (Midtrans sandbox) |
| `/cashflow [days]` | Cash flow report (default 7 days) |
| `/contact search\|detail` | Search contacts |
| `/stock movements\|summary` | Inventory movement report |
| `/category list\|add` | Expense categories |
| `/retry [status\|last]` | Retry failed actions |
| `/thread [topic\|clear]` | Set conversation topic context |

## Development

```bash
pnpm dev           # turbo run dev — starts all apps
pnpm build         # turbo run build
pnpm lint          # biome check
pnpm format        # biome format --write
pnpm check-types   # turbo run check-types
```

**Dev server details:**
- `apps/api`: `mastra dev` (tsx) with hot reload
- `apps/web`: `vite` on port 5173
- `apps/worker`: `bun --watch src/index.ts`

## Adding a New Skill

1. Create `apps/api/skills/<skill-name>/SKILL.md` with frontmatter (`name`, `description`, `version`, `tags`)
2. Write the ordered tool-call sequence in Indonesian
3. Add slash command mapping in `owner-supervisor.ts` `supervisorInstructions`
4. Optionally add a BullMQ job type in `packages/queue/src/index.ts` if the skill needs background processing