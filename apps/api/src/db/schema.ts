import type { Db } from './client.js';

const DDL = [
  `CREATE TABLE IF NOT EXISTS notes (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     content      TEXT    NOT NULL,
     category     TEXT,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS transactions (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     kind         TEXT    NOT NULL CHECK (kind IN ('income','expense')),
     amount_idr   INTEGER NOT NULL CHECK (amount_idr > 0),
     description  TEXT,
     occurred_at  INTEGER NOT NULL,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS reminders (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     content      TEXT    NOT NULL,
     remind_at    INTEGER NOT NULL,
     done         INTEGER NOT NULL DEFAULT 0,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS products (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     sku          TEXT,
     name         TEXT    NOT NULL,
     price_idr    INTEGER NOT NULL CHECK (price_idr >= 0),
     stock_qty    INTEGER NOT NULL DEFAULT 0,
     low_stock_at INTEGER NOT NULL DEFAULT 0,
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS stock_movements (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     product_id   INTEGER NOT NULL,
     delta        INTEGER NOT NULL,
     reason       TEXT,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS contacts (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     type         TEXT    NOT NULL CHECK (type IN ('customer','supplier','other')),
     name         TEXT    NOT NULL,
     phone        TEXT,
     email        TEXT,
     notes        TEXT,
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS invoices (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     contact_id   INTEGER,
     amount_idr   INTEGER NOT NULL CHECK (amount_idr > 0),
     description  TEXT,
     due_at       INTEGER,
     paid_at      INTEGER,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     tenant_id    TEXT    NOT NULL,
     key          TEXT    NOT NULL,
     value        TEXT,
     updated_at   INTEGER NOT NULL,
     PRIMARY KEY (tenant_id, key)
   )`,
  `CREATE TABLE IF NOT EXISTS scheduled_prompts (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     prompt       TEXT    NOT NULL,
     interval_sec INTEGER NOT NULL,
     cron_expr    TEXT    NOT NULL,
     next_fire_at INTEGER NOT NULL,
     active       INTEGER NOT NULL DEFAULT 1,
     last_fire_at INTEGER,
     last_result  TEXT,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_credentials (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     device_name  TEXT,
     auth_state   TEXT    NOT NULL,
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL,
     UNIQUE (tenant_id, device_name)
   )`,
  'DROP TABLE IF EXISTS agent_settings',
  `CREATE TABLE IF NOT EXISTS agent_settings (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     key          TEXT    NOT NULL,
     value        TEXT,
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL,
     UNIQUE (tenant_id, key)
   )`,
  `CREATE TABLE IF NOT EXISTS orders (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     customer_phone TEXT   NOT NULL,
     product_id   INTEGER NOT NULL,
     qty          INTEGER NOT NULL DEFAULT 1,
     total_idr    INTEGER NOT NULL,
     status       TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','paid','cancelled')),
     payment_id   INTEGER,
     payment_status TEXT   NOT NULL DEFAULT 'unpaid'
                    CHECK (payment_status IN ('unpaid','paid','cancelled')),
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS conversations (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     channel      TEXT    NOT NULL CHECK (channel IN ('whatsapp','telegram')),
     customer_phone TEXT  NOT NULL,
     direction    TEXT    NOT NULL CHECK (direction IN ('inbound','outbound')),
     message      TEXT    NOT NULL,
     message_id   TEXT,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS expense_categories (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     name         TEXT    NOT NULL,
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS memory (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     type         TEXT    NOT NULL CHECK (type IN ('note','fact','preference','context')),
     content      TEXT    NOT NULL,
     importance   INTEGER NOT NULL DEFAULT 1,
     last_accessed_at INTEGER,
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS memory_recalls (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     memory_id    INTEGER NOT NULL,
     recall_count INTEGER NOT NULL DEFAULT 0,
     last_recalled_at INTEGER,
     FOREIGN KEY (memory_id) REFERENCES memory(id)
   )`,
  `CREATE TABLE IF NOT EXISTS tool_approvals (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     tool_name    TEXT    NOT NULL,
     approved     INTEGER NOT NULL DEFAULT 0,
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL,
     UNIQUE (tenant_id, tool_name)
   )`,
  `CREATE TABLE IF NOT EXISTS payments (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     order_id     INTEGER NOT NULL,
     amount_idr   INTEGER NOT NULL,
     fee          INTEGER NOT NULL DEFAULT 0,
     total_payment INTEGER NOT NULL,
     payment_method TEXT  NOT NULL,
     payment_number TEXT,
     qr_image      TEXT,
     status       TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','cancelled','expired')),
     expired_at   INTEGER,
     completed_at INTEGER,
     pakasir_response TEXT,
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_notes_tenant_created
     ON notes (tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_tenant_occurred
     ON transactions (tenant_id, occurred_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_tenant_pending
     ON reminders (tenant_id, done, remind_at)`,
  `CREATE INDEX IF NOT EXISTS idx_products_tenant_name
     ON products (tenant_id, name)`,
  `CREATE INDEX IF NOT EXISTS idx_products_tenant_stock
     ON products (tenant_id, stock_qty)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_product
     ON stock_movements (tenant_id, product_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_contacts_tenant_type
     ON contacts (tenant_id, type, name)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_tenant_paid
     ON invoices (tenant_id, paid_at)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_tenant_due
     ON invoices (tenant_id, due_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sched_prompts_tenant_active_next
     ON scheduled_prompts (tenant_id, active, next_fire_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_tenant_status
     ON orders (tenant_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_tenant_customer
     ON orders (tenant_id, customer_phone)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_tenant_channel
     ON conversations (tenant_id, channel, customer_phone, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_expense_categories_tenant
     ON expense_categories (tenant_id, name)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_tenant_type
     ON memory (tenant_id, type, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_recalls_memory
     ON memory_recalls (memory_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tool_approvals_tenant
     ON tool_approvals (tenant_id, tool_name)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_tenant_order
     ON payments (tenant_id, order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_tenant_status
     ON payments (tenant_id, status)`,
  `CREATE TABLE IF NOT EXISTS order_status_history (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     order_id     INTEGER NOT NULL,
     old_status   TEXT,
     new_status  TEXT    NOT NULL,
     changed_by   TEXT    NOT NULL,
     note         TEXT,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_order_status_history_order
     ON order_status_history (tenant_id, order_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id    TEXT    NOT NULL,
     tool_id      TEXT    NOT NULL,
     tool_name    TEXT    NOT NULL,
     action       TEXT    NOT NULL CHECK (action IN ('execute','approve','reject')),
     actor        TEXT    NOT NULL CHECK (actor IN ('owner','customer','agent','system')),
     input_json   TEXT,
     result_json  TEXT,
     status       TEXT    NOT NULL CHECK (status IN ('success','error','rejected','timeout','pending')),
     channel      TEXT    NOT NULL CHECK (channel IN ('telegram','whatsapp','api','system')),
     conversation_id TEXT,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant
     ON audit_logs (tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_tool
     ON audit_logs (tool_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_status
     ON audit_logs (tenant_id, status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS workflow_versions (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     workflow_id  TEXT    NOT NULL,
     version      INTEGER NOT NULL,
     name          TEXT    NOT NULL,
     description  TEXT,
     trigger_type  TEXT    NOT NULL,
     trigger_config TEXT,
     steps_json    TEXT    NOT NULL,
     definition    TEXT    NOT NULL,
     created_at    INTEGER NOT NULL,
     is_active     INTEGER NOT NULL DEFAULT FALSE
   )`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_versions_id_active
     ON workflow_versions (workflow_id, is_active)`,
];

export async function initSchema(db: Db): Promise<void> {
  // Set pragmas - ignore errors in case database is locked or already configured
  // This allows multiple test files to run in parallel without lock contention
  try {
    await db.execute({ sql: 'PRAGMA journal_mode=WAL', args: [] });
  } catch {
    // WAL mode might fail if locked - that's OK, DB still works
  }
  try {
    await db.execute({ sql: 'PRAGMA busy_timeout=30000', args: [] });
  } catch {
    // Ignore
  }
  try {
    await db.execute({ sql: 'PRAGMA synchronous=NORMAL', args: [] });
  } catch {
    // Ignore
  }
  for (const sql of DDL) {
    await db.execute(sql);
  }
}
