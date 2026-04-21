# Juragan v1.0 - Detailed TODO

## Document Status

- Status: Planning
- Purpose: backlog rinci yang siap dieksekusi
- Audience: execution owner dan engineering
- Scope: task per fase, granular checklist, dan verification items

## Backlog Rules

1. Checklist ini diturunkan dari `plan.md`.
2. Item yang menyentuh channel, payment, order, atau stock harus diperlakukan sebagai high risk.
3. Jangan mulai advanced generation sebelum commerce core stabil.
4. Jika ada tradeoff, prioritaskan correctness of state over speed of delivery.

## Phase 1 - Infrastructure

### 1.1 Dependency and Project Setup

- [ ] 1.1.1 Install `@whiskeysockets/baileys`
- [ ] 1.1.2 Verify dependency resolves in workspace package manager
- [ ] 1.1.3 Review compatibility with current runtime and Node version
- [ ] 1.1.4 Add package notes if Baileys requires special handling

### 1.2 Database Schema Foundation

- [ ] 1.2.1 Open `apps/api/src/db/schema.ts`
- [ ] 1.2.2 Add `agent_settings` table
- [ ] 1.2.3 Add `orders` table
- [ ] 1.2.4 Add `order_status_history` table
- [ ] 1.2.5 Add `conversations` table
- [ ] 1.2.6 Add `payments` table
- [ ] 1.2.7 Add `shipping_costs` table
- [ ] 1.2.8 Add `expense_categories` table
- [ ] 1.2.9 Add `memory` table
- [ ] 1.2.10 Add `memory_recalls` table
- [ ] 1.2.11 Add `tool_approvals` table
- [ ] 1.2.12 Add `auto_reply_rules` table
- [ ] 1.2.13 Add indexes for lookup-heavy columns
- [ ] 1.2.14 Add migration SQL for existing databases

### 1.3 Settings and Configuration

- [ ] 1.3.1 Ensure dashboard can store OpenRouter API key
- [ ] 1.3.2 Ensure dashboard can store Telegram Bot Token
- [ ] 1.3.3 Ensure dashboard can store Pakasir API key and project slug
- [ ] 1.3.4 Ensure dashboard can store Rajaongkir API key
- [ ] 1.3.5 Add `model_config` structure to `agent_settings`
- [ ] 1.3.6 Add `customer_agent_enabled` default setting

### 1.4 WhatsApp Channel Setup

- [ ] 1.4.1 Create `apps/api/src/channels/whatsapp.ts`
- [ ] 1.4.2 Implement auth state with persistent storage
- [ ] 1.4.3 Implement QR update callback
- [ ] 1.4.4 Implement connection update handler
- [ ] 1.4.5 Implement inbound message handler
- [ ] 1.4.6 Implement outbound send message helper
- [ ] 1.4.7 Implement reconnect strategy
- [ ] 1.4.8 Handle auth invalidation and re-pair scenario
- [ ] 1.4.9 Support text and basic media send

### 1.5 WhatsApp API Routes

- [ ] 1.5.1 Add `GET /custom/whatsapp/qr`
- [ ] 1.5.2 Add QR rendering helper
- [ ] 1.5.3 Add `GET /custom/whatsapp/status`
- [ ] 1.5.4 Add `POST /custom/whatsapp/connect`
- [ ] 1.5.5 Add `POST /custom/whatsapp/disconnect`
- [ ] 1.5.6 Persist auth and connection status safely

### 1.6 Telegram Runtime Verification

- [ ] 1.6.1 Verify current Telegram adapter still works
- [ ] 1.6.2 Confirm owner messages can be received
- [ ] 1.6.3 Confirm outbound notification still works

### 1.7 Phase 1 Verification

- [ ] 1.7.1 QR visible in dashboard
- [ ] 1.7.2 WhatsApp can connect
- [ ] 1.7.3 Status endpoint returns correct state
- [ ] 1.7.4 DB migration succeeds cleanly

## Phase 2 - Customer Commerce Core

### 2.1 Customer Agent Skeleton

- [ ] 2.1.1 Create `apps/api/src/agents/customer/index.ts`
- [ ] 2.1.2 Register `juragan-customer`
- [ ] 2.1.3 Write instructions for catalog, order, payment, shipping, and escalation
- [ ] 2.1.4 Set customer agent memory to `undefined`
- [ ] 2.1.5 Wire WhatsApp adapter to customer agent

### 2.2 Customer Workspace

- [ ] 2.2.1 Create `apps/api/src/workspaces/customer.ts`
- [ ] 2.2.2 Use path `data/workspaces/{tenantId}/customer/`
- [ ] 2.2.3 Create `conversations/`
- [ ] 2.2.4 Create `templates/`
- [ ] 2.2.5 Create `files/`
- [ ] 2.2.6 Ensure workspace bootstrap exists

### 2.3 Catalog and Order Tools

- [ ] 2.3.1 Create `list-products.ts`
- [ ] 2.3.2 Implement read-only catalog output
- [ ] 2.3.3 Create `create-order.ts`
- [ ] 2.3.4 Insert order with initial status `pending`
- [ ] 2.3.5 Create `check-order.ts`
- [ ] 2.3.6 Restrict order visibility to allowed lookup path

### 2.4 Conversation Logging

- [ ] 2.4.1 Create conversation logger
- [ ] 2.4.2 Store inbound messages in `conversations`
- [ ] 2.4.3 Store outbound messages in `conversations`
- [ ] 2.4.4 Write chat history to workspace file per phone number
- [ ] 2.4.5 Include tenant, channel, phone, direction, and message content

### 2.5 Customer Agent Guard Checks

- [ ] 2.5.1 Read `customer_agent_enabled` before dispatch
- [ ] 2.5.2 Return offline message if disabled
- [ ] 2.5.3 Check business hours and vacation rules
- [ ] 2.5.4 Prevent execution if guard check fails

### 2.6 Pakasir Integration

- [ ] 2.6.1 Create `apps/api/src/services/pakasir.ts`
- [ ] 2.6.2 Implement create transaction
- [ ] 2.6.3 Implement cancel transaction
- [ ] 2.6.4 Create `request-payment.ts`
- [ ] 2.6.5 Create `check-payment.ts`
- [ ] 2.6.6 Render QR image
- [ ] 2.6.7 Send QR via WhatsApp
- [ ] 2.6.8 Add `POST /custom/pakasir/webhook`
- [ ] 2.6.9 Validate webhook payload
- [ ] 2.6.10 Update `payments` and related order state
- [ ] 2.6.11 Add payment simulation path for sandbox testing if available

### 2.7 Rajaongkir Integration

- [ ] 2.7.1 Create `apps/api/src/services/rajaongkir.ts`
- [ ] 2.7.2 Implement province lookup
- [ ] 2.7.3 Implement city lookup
- [ ] 2.7.4 Implement shipping cost calculation
- [ ] 2.7.5 Create `calculate-shipping.ts`
- [ ] 2.7.6 Create `track-shipping.ts`
- [ ] 2.7.7 Create `request-shipping.ts`
- [ ] 2.7.8 Add API routes for shipping lookup if dashboard uses them
- [ ] 2.7.9 Add 24-hour cache for province and city data

### 2.8 Full Invoice Order Flow

- [ ] 2.8.1 Create `invoice-order.ts`
- [ ] 2.8.2 Combine product, shipping, and payment into one flow
- [ ] 2.8.3 Validate stock before payment generation
- [ ] 2.8.4 Evaluate `auto_process`
- [ ] 2.8.5 Escalate to owner if approval needed
- [ ] 2.8.6 Notify customer on each meaningful state change

### 2.9 Cancellation and Tracking

- [ ] 2.9.1 Create `request-cancel.ts`
- [ ] 2.9.2 Allow cancel only before `processing`
- [ ] 2.9.3 Create `track-delivery.ts`
- [ ] 2.9.4 Return AWB or tracking summary if available

### 2.10 Phase 2 Verification

- [ ] 2.10.1 Customer asks product question and gets answer
- [ ] 2.10.2 Customer creates order successfully
- [ ] 2.10.3 Customer receives payment QR
- [ ] 2.10.4 Payment webhook updates order state
- [ ] 2.10.5 Customer checks order status
- [ ] 2.10.6 Customer gets offline message when agent disabled
- [ ] 2.10.7 Conversation log exists in DB and workspace file

## Phase 3 - Owner Core

### 3.1 Owner Agent Setup

- [ ] 3.1.1 Create `apps/api/src/agents/owner/index.ts`
- [ ] 3.1.2 Register `juragan-owner`
- [ ] 3.1.3 Set default model
- [ ] 3.1.4 Write owner instructions for full business control
- [ ] 3.1.5 Enable owner memory with short-term retention

### 3.2 Owner Workspace

- [ ] 3.2.1 Create `apps/api/src/workspaces/owner.ts`
- [ ] 3.2.2 Use path `data/workspaces/{tenantId}/owner/`
- [ ] 3.2.3 Create `files/`
- [ ] 3.2.4 Create `skills/`
- [ ] 3.2.5 Create `design-system/`
- [ ] 3.2.6 Create `MEMORY.md`
- [ ] 3.2.7 Ensure owner can read customer workspace

### 3.3 Migrate Existing Owner Tools

- [ ] 3.3.1 Create `apps/api/src/tools/owner/`
- [ ] 3.3.2 Move notes tools
- [ ] 3.3.3 Move transactions tools
- [ ] 3.3.4 Move reminders tools
- [ ] 3.3.5 Move products tools
- [ ] 3.3.6 Move contacts tools
- [ ] 3.3.7 Move invoices tools
- [ ] 3.3.8 Move scheduled prompts tools
- [ ] 3.3.9 Update imports
- [ ] 3.3.10 Re-register tools in owner agent

### 3.4 New Owner Tools

- [ ] 3.4.1 Create `customer-orders.ts`
- [ ] 3.4.2 Create `customer-conversations.ts`
- [ ] 3.4.3 Create `customer-agent-ctl.ts`
- [ ] 3.4.4 Create `cashflow-report.ts`
- [ ] 3.4.5 Create `expense-category.ts`
- [ ] 3.4.6 Create `search-contacts.ts`
- [ ] 3.4.7 Create `stock-movements.ts`
- [ ] 3.4.8 Create `memory-search.ts`
- [ ] 3.4.9 Create `memory-read.ts`

### 3.5 Telegram and Mastra Wiring

- [ ] 3.5.1 Verify Telegram adapter on owner agent
- [ ] 3.5.2 Register owner and customer agents in Mastra
- [ ] 3.5.3 Ensure no circular dependency in bootstrap
- [ ] 3.5.4 Confirm owner messages are routed correctly

### 3.6 Phase 3 Verification

- [ ] 3.6.1 Owner can send message through Telegram
- [ ] 3.6.2 Owner can CRUD core business data
- [ ] 3.6.3 Owner can read customer orders
- [ ] 3.6.4 Owner can read customer conversations
- [ ] 3.6.5 Owner can enable or disable Customer Agent

## Phase 4 - Commands and Control

### 4.1 Command Infrastructure

- [ ] 4.1.1 Create `commands.ts`
- [ ] 4.1.2 Implement command parser
- [ ] 4.1.3 Implement registry and dispatch
- [ ] 4.1.4 Handle invalid command feedback

### 4.2 Order Commands

- [ ] 4.2.1 Implement `/order list`
- [ ] 4.2.2 Implement `/order approve [id]`
- [ ] 4.2.3 Implement `/order reject [id]`
- [ ] 4.2.4 Send outbound notification to customer after decision

### 4.3 Customer Commands

- [ ] 4.3.1 Implement `/customer orders`
- [ ] 4.3.2 Implement `/customer view [phone]`
- [ ] 4.3.3 Implement `/customer override [id]`
- [ ] 4.3.4 Implement optional `/customer analytics`

### 4.4 Customer Agent Commands

- [ ] 4.4.1 Implement `/customer-agent status`
- [ ] 4.4.2 Implement `/customer-agent enable`
- [ ] 4.4.3 Implement `/customer-agent disable`
- [ ] 4.4.4 Implement `/customer-agent view-all`

### 4.5 Model and Memory Commands

- [ ] 4.5.1 Implement `/model`
- [ ] 4.5.2 Implement `/model [provider/model]`
- [ ] 4.5.3 Persist runtime model config
- [ ] 4.5.4 Implement `/memory search [query]`
- [ ] 4.5.5 Implement `/memory read [id]`
- [ ] 4.5.6 Implement `/memory stats`

### 4.6 Operator Utility Commands

- [ ] 4.6.1 Implement `/skill [name]`
- [ ] 4.6.2 Implement `/retry`
- [ ] 4.6.3 Implement `/thread [topic]`

### 4.7 Phase 4 Verification

- [ ] 4.7.1 All order commands work
- [ ] 4.7.2 Customer commands return correct data
- [ ] 4.7.3 Customer Agent commands update live behavior
- [ ] 4.7.4 Model switch works without restart

## Phase 5 - Skills and Automation

### 5.1 Existing Skills Review

- [ ] 5.1.1 Review `daily-checkin`
- [ ] 5.1.2 Review `customer-followup`
- [ ] 5.1.3 Review `price-calculation`

### 5.2 New Skills

- [ ] 5.2.1 Create `stock-opname`
- [ ] 5.2.2 Create `supplier-order`
- [ ] 5.2.3 Create `wa-blast`
- [ ] 5.2.4 Create `invoice-reminder`
- [ ] 5.2.5 Create `expense-claim`

### 5.3 Registration and Testing

- [ ] 5.3.1 Register all 8 skills
- [ ] 5.3.2 Test trigger loading
- [ ] 5.3.3 Test manual execution via `/skill`

## Phase 6 - Memory System

### 6.1 Infrastructure

- [ ] 6.1.1 Create `apps/api/src/memory/dreaming.ts`
- [ ] 6.1.2 Create scheduler integration
- [ ] 6.1.3 Implement CRUD for memory table

### 6.2 Dreaming Phases

- [ ] 6.2.1 Implement light dream
- [ ] 6.2.2 Implement REM dream
- [ ] 6.2.3 Implement deep dream
- [ ] 6.2.4 Update `MEMORY.md`
- [ ] 6.2.5 Track recall count and weights

### 6.3 Verification

- [ ] 6.3.1 Memory survives across sessions
- [ ] 6.3.2 Search returns relevant entries
- [ ] 6.3.3 Dreaming jobs do not corrupt state

## Phase 7 - Workflows

### 7.1 Order Approval Workflow

- [ ] 7.1.1 Create `order-approval.ts`
- [ ] 7.1.2 Add check order step
- [ ] 7.1.3 Add notify owner step
- [ ] 7.1.4 Add suspend for approval
- [ ] 7.1.5 Add notify customer step

### 7.2 Restock Workflow

- [ ] 7.2.1 Create `restock.ts`
- [ ] 7.2.2 Add low stock analysis step
- [ ] 7.2.3 Add supplier lookup step
- [ ] 7.2.4 Add draft PO step
- [ ] 7.2.5 Add suspend for approval
- [ ] 7.2.6 Add supplier confirmation step

### 7.3 Customer Follow-Up Workflow

- [ ] 7.3.1 Create `customer-followup.ts`
- [ ] 7.3.2 Find overdue invoices
- [ ] 7.3.3 Draft follow-up content
- [ ] 7.3.4 Send to owner for review if needed

### 7.4 Workflow Verification

- [ ] 7.4.1 Workflow run can be created
- [ ] 7.4.2 Workflow can suspend
- [ ] 7.4.3 Workflow can resume from Telegram action
- [ ] 7.4.4 Workflow survives restart

## Phase 8 - Dashboard

### 8.1 Operational Components

- [ ] 8.1.1 Create `ChannelStatus`
- [ ] 8.1.2 Create `AgentToggle`
- [ ] 8.1.3 Create `ConversationsViewer`
- [ ] 8.1.4 Create `OrdersTable`

### 8.2 Generated Content Components

- [ ] 8.2.1 Create `DocumentPreview`
- [ ] 8.2.2 Create `BrandGuidePreview`
- [ ] 8.2.3 Add chart or data preview component if needed

### 8.3 Supporting API Routes

- [ ] 8.3.1 Add `GET /custom/agent-settings`
- [ ] 8.3.2 Add `POST /custom/agent-settings`
- [ ] 8.3.3 Add `GET /custom/conversations`
- [ ] 8.3.4 Add `GET /custom/orders`
- [ ] 8.3.5 Add `GET /custom/dashboard/stats`

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

- [ ] 9.4.1 Update `docker-compose.yml`
- [ ] 9.4.2 Add volume for WhatsApp auth persistence
- [ ] 9.4.3 Update `.env.example`
- [ ] 9.4.4 Document required environment variables
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
