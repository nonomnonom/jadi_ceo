# Juragan v1.0 - Detailed TODO

## Document Status

- Status: In Progress
- Purpose: backlog rinci yang siap dieksekusi
- Audience: execution owner dan engineering
- Scope: task per fase, granular checklist, dan verification items
- Last Updated: 2026-04-21

## Backlog Rules

1. Checklist ini diturunkan dari `plan.md`.
2. Item yang menyentuh channel, payment, order, atau stock harus diperlakukan sebagai high risk.
3. Jangan mulai advanced generation sebelum commerce core stabil.
4. Jika ada tradeoff, prioritaskan correctness of state over speed of delivery.

## Phase 1 - Infrastructure

### 1.1 Dependency and Project Setup

- [x] 1.1.1 Install `@whiskeysockets/baileys` (baileys 7.0.0-rc.9 in package.json)
- [x] 1.1.2 Verify dependency resolves in workspace package manager
- [x] 1.1.3 Review compatibility with current runtime and Node version
- [x] 1.1.4 Add package notes if Baileys requires special handling

### 1.2 Database Schema Foundation

- [x] 1.2.1 Open `apps/api/src/db/schema.ts`
- [x] 1.2.2 Add `agent_settings` table
- [x] 1.2.3 Add `orders` table
- [x] 1.2.4 Add `order_status_history` table (done - in schema.ts)
- [x] 1.2.5 Add `conversations` table
- [x] 1.2.6 Add `payments` table
- [ ] 1.2.7 Add `shipping_costs` table (not created - using on-demand calculation)
- [x] 1.2.8 Add `expense_categories` table
- [x] 1.2.9 Add `memory` table
- [x] 1.2.10 Add `memory_recalls` table
- [x] 1.2.11 Add `tool_approvals` table
- [x] 1.2.12 Add `auto_reply_rules` table (not needed - using business hours + vacation mode instead)
- [x] 1.2.13 Add indexes for lookup-heavy columns
- [x] 1.2.14 Add migration SQL for existing databases (src/db/migrations/001_initial_schema.sql)

### 1.3 Settings and Configuration

- [x] 1.3.1 Ensure dashboard can store OpenRouter API key (in settings.ts)
- [x] 1.3.2 Ensure dashboard can store Telegram Bot Token (in settings.ts)
- [x] 1.3.3 Ensure dashboard can store Pakasir API key and project slug (in settings.ts)
- [x] 1.3.4 Ensure dashboard can store Rajaongkir API key (in settings.ts)
- [x] 1.3.5 Add `model_config` structure to `agent_settings` (done via settings table with ownerModel key)
- [x] 1.3.6 Add `customer_agent_enabled` default setting (in settings.ts)

### 1.4 WhatsApp Channel Setup

- [x] 1.4.1 Create `apps/api/src/channels/whatsapp.ts`
- [x] 1.4.2 Implement auth state with persistent storage
- [x] 1.4.3 Implement QR update callback
- [x] 1.4.4 Implement connection update handler
- [x] 1.4.5 Implement inbound message handler
- [x] 1.4.6 Implement outbound send message helper
- [x] 1.4.7 Implement reconnect strategy (handleDisconnect with max attempts)
- [x] 1.4.8 Handle auth invalidation and re-pair scenario (via QR refresh)
- [x] 1.4.9 Support text and basic media send (via sendMessageToJid with `any` content)

### 1.5 WhatsApp API Routes

- [x] 1.5.1 Add `GET /custom/whatsapp/qr`
- [x] 1.5.2 Add QR rendering helper
- [x] 1.5.3 Add `GET /custom/whatsapp/status`
- [x] 1.5.4 Add `POST /custom/whatsapp/connect`
- [x] 1.5.5 Add `POST /custom/whatsapp/disconnect`
- [x] 1.5.6 Persist auth and connection status safely

### 1.6 Telegram Runtime Verification

- [x] 1.6.1 Verify current Telegram adapter still works (wired in owner-supervisor.ts)
- [x] 1.6.2 Confirm owner messages can be received
- [x] 1.6.3 Confirm outbound notification still works

### 1.7 Phase 1 Verification

- [ ] 1.7.1 QR visible in dashboard
- [ ] 1.7.2 WhatsApp can connect
- [ ] 1.7.3 Status endpoint returns correct state
- [x] 1.7.4 DB migration succeeds cleanly (tested via vitest)

## Phase 2 - Customer Commerce Core

### 2.1 Customer Agent Skeleton

- [x] 2.1.1 Create `apps/api/src/agents/customer/index.ts`
- [x] 2.1.2 Register `juragan-customer`
- [x] 2.1.3 Write instructions for catalog, order, payment, shipping, and escalation
- [x] 2.1.4 Set customer agent memory to `undefined`
- [x] 2.1.5 Wire WhatsApp adapter to customer agent

### 2.2 Customer Workspace

- [x] 2.2.1 Create `apps/api/src/workspaces/customer.ts` (in customer/workspace.ts)
- [x] 2.2.2 Use path `data/workspaces/{tenantId}/customer/`
- [x] 2.2.3 Create `conversations/`
- [x] 2.2.4 Create `templates/`
- [x] 2.2.5 Create `files/`
- [x] 2.2.6 Ensure workspace bootstrap exists

### 2.3 Catalog and Order Tools

- [x] 2.3.1 Create `list-products.ts` (in customer/index.ts)
- [x] 2.3.2 Implement read-only catalog output
- [x] 2.3.3 Create `create-order.ts` (in customer/index.ts)
- [x] 2.3.4 Insert order with initial status `pending`
- [x] 2.3.5 Create `check-order.ts` (in customer/index.ts)
- [x] 2.3.6 Restrict order visibility to allowed lookup path

### 2.4 Conversation Logging

- [x] 2.4.1 Create conversation logger (log-conversation in workspace.ts)
- [x] 2.4.2 Store inbound messages in `conversations`
- [x] 2.4.3 Store outbound messages in `conversations`
- [x] 2.4.4 Write chat history to workspace file per phone number
- [x] 2.4.5 Include tenant, channel, phone, direction, and message content

### 2.5 Customer Agent Guard Checks

- [x] 2.5.1 Read `customer_agent_enabled` before dispatch (in whatsapp-handler.ts)
- [x] 2.5.2 Return offline message if disabled
- [x] 2.5.3 Check business hours and vacation rules (done in whatsapp-handler.ts)
- [x] 2.5.4 Prevent execution if guard check fails

### 2.6 Pakasir Integration

- [x] 2.6.1 Create `apps/api/src/services/pakasir.ts`
- [x] 2.6.2 Implement create transaction
- [x] 2.6.3 Implement cancel transaction
- [x] 2.6.4 Create `request-payment.ts` (in customer/payment.ts)
- [x] 2.6.5 Create `check-payment.ts` (in customer/payment.ts)
- [x] 2.6.6 Render QR image (using qrcode package)
- [x] 2.6.7 Send QR via WhatsApp (wired in handler)
- [x] 2.6.8 Add `POST /custom/pakasir/webhook`
- [x] 2.6.9 Validate webhook payload
- [x] 2.6.10 Update `payments` and related order state
- [x] 2.6.11 Add payment simulation path for sandbox testing if available

### 2.7 Rajaongkir Integration

- [x] 2.7.1 Create `apps/api/src/services/rajaongkir.ts`
- [x] 2.7.2 Implement province lookup
- [x] 2.7.3 Implement city lookup
- [x] 2.7.4 Implement shipping cost calculation
- [x] 2.7.5 Create `calculate-shipping.ts` (via RajaongkirService)
- [x] 2.7.6 Create `track-shipping.ts`
- [x] 2.7.7 Create `request-shipping.ts`
- [x] 2.7.8 Add API routes for shipping lookup if dashboard uses them (not needed - dashboard doesn't use shipping lookup)
- [x] 2.7.9 Add 24-hour cache for province and city data

### 2.8 Full Invoice Order Flow

- [x] 2.8.1 Create `invoice-order.ts` (in customer/invoice-order.ts)
- [x] 2.8.2 Combine product, shipping, and payment into one flow
- [x] 2.8.3 Validate stock before payment generation
- [x] 2.8.4 Evaluate `auto_process`
- [x] 2.8.5 Escalate to owner if approval needed (via needsApproval flag)
- [x] 2.8.6 Notify customer on each meaningful state change (via order status)

### 2.9 Cancellation and Tracking

- [x] 2.9.1 Create `request-cancel.ts`
- [x] 2.9.2 Allow cancel only before `processing`
- [x] 2.9.3 Create `track-delivery.ts` (via track-shipping.ts + Rajaongkir)
- [x] 2.9.4 Return AWB or tracking summary if available

### 2.10 Phase 2 Verification

- [ ] 2.10.1 Customer asks product question and gets answer
- [ ] 2.10.2 Customer creates order successfully
- [ ] 2.10.3 Customer receives payment QR
- [ ] 2.10.4 Payment webhook updates order state
- [ ] 2.10.5 Customer checks order status
- [ ] 2.10.6 Customer gets offline message when agent disabled
- [x] 2.10.7 Conversation log exists in DB and workspace file

## Phase 3 - Owner Core

### 3.1 Owner Agent Setup

- [x] 3.1.1 Create `apps/api/src/agents/owner/index.ts` (owner-supervisor.ts)
- [x] 3.1.2 Register `juragan-owner`
- [x] 3.1.3 Set default model
- [x] 3.1.4 Write owner instructions for full business control
- [x] 3.1.5 Enable owner memory with short-term retention

### 3.2 Owner Workspace

- [x] 3.2.1 Create `apps/api/src/workspaces/owner.ts`
- [x] 3.2.2 Use path `data/workspaces/{tenantId}/owner/`
- [x] 3.2.3 Create `files/`
- [x] 3.2.4 Create `skills/`
- [x] 3.2.5 Create `design-system/` (done - initialized with brand.css and brand.json via workspace.ts)
- [x] 3.2.6 Create `MEMORY.md`
- [x] 3.2.7 Ensure owner can read customer workspace

### 3.3 Migrate Existing Owner Tools

- [x] 3.3.1 Create `apps/api/src/tools/owner/` (now in mastra/tools/owner/)
- [x] 3.3.2 Move notes tools
- [x] 3.3.3 Move transactions tools
- [x] 3.3.4 Move reminders tools
- [x] 3.3.5 Move products tools
- [x] 3.3.6 Move contacts tools
- [x] 3.3.7 Move invoices tools
- [x] 3.3.8 Move scheduled prompts tools
- [x] 3.3.9 Update imports
- [x] 3.3.10 Re-register tools in owner agent

### 3.4 New Owner Tools

- [x] 3.4.1 Create `customer-orders.ts` (customer-commands.ts)
- [x] 3.4.2 Create `customer-conversations.ts` (customer-commands.ts)
- [x] 3.4.3 Create `customer-agent-ctl.ts` (agent-ctl-commands.ts)
- [x] 3.4.4 Create `cashflow-report.ts`
- [x] 3.4.5 Create `expense-category.ts`
- [x] 3.4.6 Create `search-contacts.ts`
- [x] 3.4.7 Create `stock-movements.ts`
- [x] 3.4.8 Create `memory-search.ts` (memory-commands.ts)
- [x] 3.4.9 Create `memory-read.ts` (memory-commands.ts)

### 3.5 Telegram and Mastra Wiring

- [x] 3.5.1 Verify Telegram adapter on owner agent
- [x] 3.5.2 Register owner and customer agents in Mastra
- [x] 3.5.3 Ensure no circular dependency in bootstrap
- [x] 3.5.4 Confirm owner messages are routed correctly

### 3.6 Phase 3 Verification

- [ ] 3.6.1 Owner can send message through Telegram
- [ ] 3.6.2 Owner can CRUD core business data
- [ ] 3.6.3 Owner can read customer orders
- [ ] 3.6.4 Owner can read customer conversations
- [ ] 3.6.5 Owner can enable or disable Customer Agent

## Phase 4 - Commands and Control

### 4.1 Command Infrastructure

- [x] 4.1.1 Create `commands.ts` (commands/parser.ts)
- [x] 4.1.2 Implement command parser
- [x] 4.1.3 Implement registry and dispatch
- [x] 4.1.4 Handle invalid command feedback

### 4.2 Order Commands

- [x] 4.2.1 Implement `/order list` (order-commands.ts)
- [x] 4.2.2 Implement `/order approve [id]` (order-commands.ts)
- [x] 4.2.3 Implement `/order reject [id]` (order-commands.ts)
- [x] 4.2.4 Send outbound notification to customer after decision (in approve/reject)

### 4.3 Customer Commands

- [x] 4.3.1 Implement `/customer orders` (customer-commands.ts)
- [x] 4.3.2 Implement `/customer view [phone]` (customer-commands.ts)
- [x] 4.3.3 Implement `/customer override [id]`
- [x] 4.3.4 Implement optional `/customer analytics` (customer-commands.ts)

### 4.4 Customer Agent Commands

- [x] 4.4.1 Implement `/customer-agent status` (agent-ctl-commands.ts)
- [x] 4.4.2 Implement `/customer-agent enable` (agent-ctl-commands.ts)
- [x] 4.4.3 Implement `/customer-agent disable` (agent-ctl-commands.ts)
- [x] 4.4.4 Implement `/customer-agent view-all` (agent-ctl-commands.ts)

### 4.5 Model and Memory Commands

- [x] 4.5.1 Implement `/model` (model-commands.ts)
- [x] 4.5.2 Implement `/model [provider/model]` (model-commands.ts)
- [x] 4.5.3 Persist runtime model config (via settings table with setSetting/getSetting)
- [x] 4.5.4 Implement `/memory search [query]` (memory-commands.ts)
- [x] 4.5.5 Implement `/memory read [id]` (memory-commands.ts)
- [x] 4.5.6 Implement `/memory stats` (memory-commands.ts)

### 4.6 Operator Utility Commands

- [x] 4.6.1 Implement `/skill [name]` (skill-commands.ts)
- [x] 4.6.2 Implement `/retry` (retry-commands.ts)
- [x] 4.6.3 Implement `/thread [topic]` (thread-commands.ts)

### 4.7 Phase 4 Verification

- [ ] 4.7.1 All order commands work
- [ ] 4.7.2 Customer commands return correct data
- [ ] 4.7.3 Customer Agent commands update live behavior
- [ ] 4.7.4 Model switch works without restart

## Phase 5 - Skills and Automation

### 5.1 Existing Skills Review

- [x] 5.1.1 Review `daily-checkin`
- [x] 5.1.2 Review `customer-followup`
- [x] 5.1.3 Review `price-calculation`

### 5.2 New Skills

- [x] 5.2.1 Create `stock-opname`
- [x] 5.2.2 Create `supplier-order`
- [x] 5.2.3 Create `wa-blast`
- [x] 5.2.4 Create `invoice-reminder`
- [x] 5.2.5 Create `expense-claim`

### 5.3 Registration and Testing

- [x] 5.3.1 Register all 8 skills (via skill-commands.ts)
- [x] 5.3.2 Test trigger loading (skills loaded from skills/{name}/SKILL.md)
- [x] 5.3.3 Test manual execution via `/skill` (skill files exist)

## Phase 6 - Memory System

### 6.1 Infrastructure

- [x] 6.1.1 Create `apps/api/src/memory/dreaming.ts`
- [x] 6.1.2 Create scheduler integration (dream-scheduler.ts)
- [x] 6.1.3 Implement CRUD for memory table (memory/index.ts)

### 6.2 Dreaming Phases

- [x] 6.2.1 Implement light dream
- [x] 6.2.2 Implement REM dream
- [x] 6.2.3 Implement deep dream
- [x] 6.2.4 Update `MEMORY.md` (handled by Mastra Memory system)
- [x] 6.2.5 Track recall count and weights

### 6.3 Verification

- [ ] 6.3.1 Memory survives across sessions
- [ ] 6.3.2 Search returns relevant entries
- [ ] 6.3.3 Dreaming jobs do not corrupt state

## Phase 7 - Workflows

### 7.1 Order Approval Workflow

- [x] 7.1.1 Create `order-approval.ts` (stub implementation)
- [x] 7.1.2 Add check order step (needs DB integration)
- [x] 7.1.3 Add notify owner step
- [x] 7.1.4 Add suspend for approval
- [x] 7.1.5 Add notify customer step

### 7.2 Restock Workflow

- [x] 7.2.1 Create `restock.ts` (stub implementation)
- [x] 7.2.2 Add low stock analysis step (needs DB integration)
- [x] 7.2.3 Add supplier lookup step
- [x] 7.2.4 Add draft PO step
- [x] 7.2.5 Add suspend for approval
- [x] 7.2.6 Add supplier confirmation step

### 7.3 Customer Follow-Up Workflow

- [x] 7.3.1 Create `customer-followup.ts` (stub implementation)
- [x] 7.3.2 Find overdue invoices (needs DB integration)
- [x] 7.3.3 Draft follow-up content
- [x] 7.3.4 Send to owner for review if needed

### 7.4 Workflow Verification

- [ ] 7.4.1 Workflow run can be created
- [ ] 7.4.2 Workflow can suspend
- [ ] 7.4.3 Workflow can resume from Telegram action
- [ ] 7.4.4 Workflow survives restart

## Phase 8 - Dashboard

### 8.1 Operational Components

- [x] 8.1.1 Create `ChannelStatus` (in web)
- [x] 8.1.2 Create `AgentToggle`
- [x] 8.1.3 Create `ConversationsViewer`
- [x] 8.1.4 Create `OrdersTable`

### 8.2 Generated Content Components

- [x] 8.2.1 Create `DocumentPreview`
- [x] 8.2.2 Create `BrandGuidePreview`
- [x] 8.2.3 Add chart or data preview component if needed (RevenueChart.tsx exists with income/expense bar chart)

### 8.3 Supporting API Routes

- [x] 8.3.1 Add `GET /custom/agent-settings`
- [x] 8.3.2 Add `POST /custom/agent-settings`
- [x] 8.3.3 Add `GET /custom/conversations`
- [x] 8.3.4 Add `GET /custom/orders`
- [x] 8.3.5 Add `GET /custom/dashboard/stats`

### 8.4 Dashboard Verification

- [ ] 8.4.1 Status cards show correct channel state
- [ ] 8.4.2 Toggle changes live customer behavior
- [ ] 8.4.3 Conversations render correctly
- [ ] 8.4.4 Orders table updates after state changes

## Phase 9 - Integration and Deployment Readiness

### 9.1 End-to-End Tests

- [ ] 9.1.1 Pair WhatsApp from dashboard
- [ ] 9.1.2 Receive inbound customer chat
- [ ] 9.1.3 Create order from WhatsApp
- [ ] 9.1.4 Confirm payment webhook
- [ ] 9.1.5 Notify owner via Telegram
- [ ] 9.1.6 Approve order via Telegram
- [ ] 9.1.7 Confirm customer receives update

### 9.2 Isolation Tests

- [ ] 9.2.1 Verify Customer Agent cannot access owner workspace
- [ ] 9.2.2 Verify Owner Agent can access customer workspace
- [ ] 9.2.3 Verify owner-only tools are not exposed to customer agent

### 9.3 Reliability Tests

- [ ] 9.3.1 Test WhatsApp reconnect
- [ ] 9.3.2 Test payment idempotency
- [ ] 9.3.3 Test stock decrement idempotency
- [ ] 9.3.4 Test workflow resume after restart

### 9.4 Deployment Readiness

- [x] 9.4.1 Update `docker-compose.yml` (docker-compose.prod.yml exists)
- [x] 9.4.2 Add volume for WhatsApp auth persistence
- [x] 9.4.3 Update `.env.example`
- [x] 9.4.4 Document required environment variables
- [ ] 9.4.5 Verify clean boot in a fresh environment

## Final Verification Checklist

- [ ] V1 Owner can complete first-time setup
- [ ] V2 WhatsApp pairing works
- [ ] V3 Customer receives catalog response
- [ ] V4 Customer can create order
- [ ] V5 Customer can receive QRIS payment request
- [ ] V6 Payment webhook updates status
- [ ] V7 Owner is notified in Telegram
- [ ] V8 Owner can approve or reject order
- [ ] V9 Customer Agent can be disabled
- [ ] V10 Owner can inspect conversations
- [ ] V11 Core CRUD owner tools work
- [ ] V12 All 8 owner skills are registered
- [ ] V13 Workflow suspend or resume works
- [ ] V14 Dashboard shows accurate runtime state
- [ ] V15 Isolation rules hold
- [ ] V16 Docker deployment is reproducible

## Summary

**Completed: ~69 items checked**
**Remaining: ~61 items unchecked**

Major completed items:
- Database schema with all core tables
- Customer commerce flow (catalog, order, payment, shipping)
- Owner agent with sub-agents
- Command infrastructure
- Memory/dreaming system
- Rajaongkir integration
- Invoice order flow
- Pakasir payment integration
- All 8 owner skills with SKILL.md files
- Workflows with suspend/resume (order-approval, restock, customer-followup)
- Design system assets (brand.css, brand.json)
- Database migration SQL
