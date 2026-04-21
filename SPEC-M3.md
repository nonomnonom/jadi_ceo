# Spec: M3 — Multi-Agent Supervisor

## Objective

Split the monolithic `juraganAgent` (Owner) into an **OwnerSupervisor** that delegates to domain-specific sub-agents. CustomerAgent (WhatsApp) stays unchanged. The goal is better maintainability, isolation, and extensibility as tool count grows.

**Current state (M2):**
- Single `juraganAgent` with 15 business tools + 5 workspace tools
- All tools declared flat on one agent
- ~24-entry tool surface for the LLM to select from

**Target state (M3):**
- `OwnerSupervisor` — coordinates delegation, owns Telegram channel, owns workspace tools, owns reminders/scheduling
- `NoteAgent` — add-note, list-notes
- `FinanceAgent` — log-transaction, get-daily-summary
- `CatalogAgent` — add-product, list-products, adjust-stock
- `ContactAgent` — add-contact, list-contacts
- `InvoiceAgent` — create-invoice, list-invoices, mark-invoice-paid
- Each sub-agent has its own `description` so the supervisor LLM can route intelligently

## Tech Stack

- **Framework:** `@mastra/core` 1.25.0 — supervisor agent pattern via `agents: {}` field
- **Runtime:** Bun (test), Node (prod)
- **Persistence:** LibSQL — no change to schema or storage layer
- **Channel:** Telegram only on OwnerSupervisor (unchanged); no sub-agent channels

## Architecture

```
OwnerSupervisor (Telegram)
  ├── NoteAgent       (domain: notes)
  ├── FinanceAgent    (domain: transactions, daily summary)
  ├── CatalogAgent    (domain: products, stock)
  ├── ContactAgent    (domain: contacts)
  └── InvoiceAgent    (domain: invoices, payments)

CustomerAgent (WhatsApp) — unchanged
```

**Key rule:** Sub-agents have NO channels. Only the supervisor holds channel adapters.

## Supervisor Instructions (OwnerSupervisor)

The supervisor instructions describe each sub-agent's domain and when to delegate:

```
Kamu adalah **Juragan** — coordinator untuk owner bisnis Indonesia.
Untuk tugas spesifik, delegasi ke agent khusus:

- noteAgent    — catatan pendek, ide, daftar. Gunakan untuk add-note, list-notes.
- financeAgent — pembukuan Income/expense, ringkasan harian. Gunakan untuk log-transaction, get-daily-summary.
- catalogAgent — produk, stok, harga. Gunakan untuk add-product, list-products, adjust-stock.
- contactAgent — kontak customer/supplier. Gunakan untuk add-contact, list-contacts.
- invoiceAgent — invoice, piutang, tagihan. Gunakan untuk create-invoice, list-invoices, mark-invoice-paid.

Untuk tugas yang bukan satu domain di atas (ringkasan campuran, pertanyaan umum, workspace file, skills, reminders),
handle sendiri dengan tool yang tersedia.

Gaya bicara: Bahasa Indonesia casual, singkat, langsung.
```

**Each sub-agent** gets minimal instructions focused only on its domain.

## Delegation Flow

1. Owner sends message via Telegram
2. `OwnerSupervisor.generate()` runs
3. LLM reads instructions → decides to delegate or handle directly
4. If delegation: `supervisorAgent.generate()` internally calls sub-agent
5. Supervisor synthesizes / returns sub-agent result directly (no result synthesis step needed for single-delegation)

## What Stays on OwnerSupervisor

These tools are NOT delegated — supervisor handles them directly:

- `getCurrentTime` — always needed, no domain
- Workspace tools (list_files, read_file, grep, write_file) — supervisor owns the workspace
- Skill tools (skill, skill_read, skill_search) — skills are cross-domain
- Scheduled prompt tools (schedulePrompt, listScheduledPrompts, cancelScheduledPrompt) — orchestration
- Reminder tools (setReminder, listReminders) — orchestration

## Memory Strategy

- **OwnerSupervisor:** `new Memory({ options: { lastMessages: 20 } })` — owns conversation history
- **Sub-agents:** no Memory instance — they receive context forwarded from supervisor per delegation

## Breaking Changes

- None to API surface or DB schema
- `juraganAgent` is replaced by `ownerSupervisor`
- All existing tool IDs remain the same (no migration needed)
- Telegram channel moves from `juraganAgent` to `ownerSupervisor`

## File Changes

| File | Change |
|------|--------|
| `src/mastra/agents/juragan.ts` | Rename to `owner-supervisor.ts`. Create supervisor with sub-agents. Move channel there. |
| `src/mastra/agents/` | New files per sub-agent: `note-agent.ts`, `finance-agent.ts`, `catalog-agent.ts`, `contact-agent.ts`, `invoice-agent.ts` |
| `src/mastra/index.ts` | Import `ownerSupervisor` instead of `juraganAgent` |
| `src/mastra/tools/scheduled-prompts.ts` | `createScheduledPromptTools` factory — no change, just re-exported |
| `src/mastra/tools/reminders.ts` | `createReminderTools` — no change, supervisor uses them directly |
| `tests/` | Tests for each sub-agent + supervisor delegation |

## Testing Strategy

1. **Sub-agent unit tests** — each agent can generate a simple response for its domain
2. **Supervisor delegation tests** — supervisor correctly routes to sub-agents based on intent
3. **Existing tool tests** — all 15 business tool tests still pass (they test the factories, not the agent)
4. **No DB schema changes** — no migration tests needed

## Commands

```bash
# Test
pnpm --filter @juragan/api test

# Build
pnpm --filter @juragan/api build

# Lint
pnpm --filter @juragan/api lint
```

## Success Criteria

- [ ] All 15 business tools accessible via supervisor delegation
- [ ] Telegram channel still works on ownerSupervisor (not on sub-agents)
- [ ] Owner can ask note, finance, catalog, contact, invoice questions and get answers
- [ ] Workspace tools still work (list_files, read_file, grep)
- [ ] Skills still work (skill, skill_read, skill_search)
- [ ] Scheduled prompts still work
- [ ] Existing test suite passes without modification
- [ ] Build succeeds
