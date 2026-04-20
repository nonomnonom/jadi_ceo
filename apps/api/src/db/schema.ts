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
  `CREATE INDEX IF NOT EXISTS idx_notes_tenant_created
     ON notes (tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_tenant_occurred
     ON transactions (tenant_id, occurred_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_reminders_tenant_pending
     ON reminders (tenant_id, done, remind_at)`,
];

export async function initSchema(db: Db): Promise<void> {
  for (const sql of DDL) {
    await db.execute(sql);
  }
}
