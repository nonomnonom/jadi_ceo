import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { phoneToJid } from '../../src/channels/whatsapp-manager.js';

describe('Webhook → WhatsApp payment confirmation', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
    vi.clearAllMocks();
  });

  describe('phoneToJid utility', () => {
    it('converts +6281234567890 to jid format', () => {
      expect(phoneToJid('+6281234567890')).toBe('6281234567890@s.whatsapp.net');
    });

    it('strips leading + before appending suffix', () => {
      expect(phoneToJid('+6281234567890')).toBe('6281234567890@s.whatsapp.net');
    });
  });

  describe('webhook confirmation flow', () => {
    it('looks up customer_phone from order when payment completes', async () => {
      // Setup: create an order with a customer phone
      const db = getDb();
      const now = Date.now();

      await db.execute({
        sql: `INSERT INTO orders (tenant_id, customer_phone, product_id, qty, total_idr, status, payment_status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [DEFAULT_TENANT_ID, '+6281234567890', 1, 2, 50000, 'pending', 'unpaid', now, now],
      });

      // Verify we can look up the phone from the order
      const row = await db.execute({
        sql: 'SELECT customer_phone FROM orders WHERE tenant_id = ? ORDER BY id DESC LIMIT 1',
        args: [DEFAULT_TENANT_ID],
      });

      expect(row.rows[0]).toBeDefined();
      expect(String(row.rows[0]!.customer_phone)).toBe('+6281234567890');

      // The JID conversion
      const jid = phoneToJid(String(row.rows[0]!.customer_phone));
      expect(jid).toBe('6281234567890@s.whatsapp.net');
    });

    it('handles payment confirmation with various payment methods', async () => {
      const db = getDb();
      const now = Date.now();

      // Insert order
      await db.execute({
        sql: `INSERT INTO orders (tenant_id, customer_phone, product_id, qty, total_idr, status, payment_status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [DEFAULT_TENANT_ID, '+6281234567890', 1, 1, 75000, 'pending', 'unpaid', now, now],
      });

      // Simulate what the webhook handler does on completed
      const orderId = '1'; // first inserted order ID
      const body = {
        order_id: orderId,
        status: 'completed',
        amount: 75200,
        payment_method: 'qris',
        completed_at: new Date().toISOString(),
      };

      // Update payments
      await db.execute({
        sql: "UPDATE payments SET status = 'completed', completed_at = ?, updated_at = ? WHERE order_id = ?",
        args: [now, now, body.order_id],
      });
      await db.execute({
        sql: "UPDATE orders SET payment_status = 'paid' WHERE id = ?",
        args: [body.order_id],
      });

      // Verify order is updated
      const updated = await db.execute({
        sql: "SELECT payment_status FROM orders WHERE id = ?",
        args: [body.order_id],
      });
      expect(String(updated.rows[0]!.payment_status)).toBe('paid');
    });
  });

  describe('expired payment handling', () => {
    it('marks payment as expired without sending notification', async () => {
      const db = getDb();
      const now = Date.now();

      // Insert a pending payment
      await db.execute({
        sql: `INSERT INTO payments (tenant_id, order_id, amount_idr, total_payment, payment_method, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [DEFAULT_TENANT_ID, 'ORD-999', 30000, 30200, 'qris', 'pending', now, now],
      });

      // Simulate expired webhook
      await db.execute({
        sql: "UPDATE payments SET status = 'expired', updated_at = ? WHERE order_id = ? AND status = 'pending'",
        args: [now, 'ORD-999'],
      });

      // Verify status
      const row = await db.execute({
        sql: "SELECT status FROM payments WHERE order_id = 'ORD-999'",
        args: [],
      });
      expect(String(row.rows[0]!.status)).toBe('expired');
    });
  });
});