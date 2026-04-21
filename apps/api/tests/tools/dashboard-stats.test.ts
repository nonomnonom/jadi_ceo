import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';

describe('dashboard stats computation', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);

    const now = Date.now();

    // Insert sample orders with different statuses
    // orders: (tenant_id, customer_phone, product_id, qty, total_idr, status, payment_status, created_at, updated_at)
    await db.execute({
      sql: `INSERT INTO orders (tenant_id, customer_phone, product_id, qty, total_idr, status, payment_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [DEFAULT_TENANT_ID, '+6281111', 1, 2, 50000, 'pending', 'unpaid', now, now],
    });
    await db.execute({
      sql: `INSERT INTO orders (tenant_id, customer_phone, product_id, qty, total_idr, status, payment_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [DEFAULT_TENANT_ID, '+6282222', 1, 3, 75000, 'pending', 'paid', now, now],
    });
    await db.execute({
      sql: `INSERT INTO orders (tenant_id, customer_phone, product_id, qty, total_idr, status, payment_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [DEFAULT_TENANT_ID, '+6283333', 1, 4, 100000, 'approved', 'paid', now, now],
    });

    // Insert a conversation (schema: tenant_id, channel, customer_phone, direction, message, message_id, created_at)
    await db.execute({
      sql: `INSERT INTO conversations (tenant_id, channel, customer_phone, direction, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [DEFAULT_TENANT_ID, 'whatsapp', '+6281111', 'inbound', 'Hello', now],
    });
  });

  it('computes total order count', async () => {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM orders WHERE tenant_id = ?',
      args: [DEFAULT_TENANT_ID],
    });
    expect(Number(result.rows[0]!.cnt)).toBe(3);
  });

  it('computes orders by status', async () => {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT status, COUNT(*) as cnt FROM orders WHERE tenant_id = ? GROUP BY status`,
      args: [DEFAULT_TENANT_ID],
    });
    const byStatus: Record<string, number> = {};
    for (const row of result.rows) {
      byStatus[String(row.status)] = Number(row.cnt);
    }
    expect(byStatus.pending).toBe(2);
    expect(byStatus.approved).toBe(1);
  });

  it('computes total revenue from paid orders', async () => {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT COALESCE(SUM(total_idr), 0) as total FROM orders WHERE tenant_id = ? AND payment_status = 'paid'`,
      args: [DEFAULT_TENANT_ID],
    });
    // Bob (75000) + Charlie (100000) = 175000
    expect(Number(result.rows[0]!.total)).toBe(175000);
  });

  it('computes pending payment count', async () => {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM orders WHERE tenant_id = ? AND payment_status = 'unpaid'`,
      args: [DEFAULT_TENANT_ID],
    });
    expect(Number(result.rows[0]!.cnt)).toBe(1);
  });

  it('computes conversation count', async () => {
    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM conversations WHERE tenant_id = ?',
      args: [DEFAULT_TENANT_ID],
    });
    expect(Number(result.rows[0]!.cnt)).toBe(1);
  });
});
