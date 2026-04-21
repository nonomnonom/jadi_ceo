import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { setSetting } from '../../src/db/settings.js';
import { runTool } from '../run-tool.js';

describe('Pakasir payment tools (customer agent)', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
    await setSetting(db, DEFAULT_TENANT_ID, 'pakasirProject' as any, 'test-project');
    await setSetting(db, DEFAULT_TENANT_ID, 'pakasirApiKey' as any, 'test-api-key');
    vi.clearAllMocks();
  });

  describe('request-payment tool', () => {
    it('creates Pakasir transaction and returns payment details', async () => {
      const { createRequestPaymentTool } = await import(
        '../../src/mastra/tools/customer/payment.js'
      );
      const db = getDb();
      const { requestPayment } = createRequestPaymentTool({ db, tenantId: DEFAULT_TENANT_ID });

      vi.stubGlobal('fetch', async () => ({
        ok: true,
        json: async () => ({
          payment: {
            project: 'test-project',
            order_id: '123',
            amount: 50000,
            fee: 200,
            total_payment: 50200,
            payment_method: 'qris',
            payment_number: 'qr_abc123',
            expired_at: '2024-09-10T10:00:00+07:00',
          },
        }),
      }));

      const result = await runTool(requestPayment, { orderId: 123, amountIdr: 50000 });

      expect(result.ok).toBe(true);
      expect(result.orderId).toBe(123);
      expect(result.paymentMethod).toBe('qris');
      expect(result.status).toBe('pending');
      expect(result.paymentNumber).toBe('qr_abc123');
      expect(result.totalPayment).toBe(50200);
      expect(result.qrImage).toBeDefined(); // base64 PNG
    });

    it('returns error when Pakasir credentials not configured', async () => {
      const { createRequestPaymentTool } = await import(
        '../../src/mastra/tools/customer/payment.js'
      );
      const db = getDb();
      await setSetting(db, DEFAULT_TENANT_ID, 'pakasirProject' as any, null);
      await setSetting(db, DEFAULT_TENANT_ID, 'pakasirApiKey' as any, null);
      const { requestPayment } = createRequestPaymentTool({ db, tenantId: DEFAULT_TENANT_ID });

      await expect(runTool(requestPayment, { orderId: 123, amountIdr: 50000 })).rejects.toThrow(
        'Pakasir credentials not configured',
      );
    });
  });

  describe('check-payment tool', () => {
    it('returns payment status from local DB', async () => {
      const { createCheckPaymentTool } = await import(
        '../../src/mastra/tools/customer/payment.js'
      );
      const db = getDb();
      const { checkPayment } = createCheckPaymentTool({ db, tenantId: DEFAULT_TENANT_ID });

      // Insert a completed payment
      const now = Date.now();
      await db.execute({
        sql: `INSERT INTO payments (tenant_id, order_id, amount_idr, total_payment, payment_method, payment_number, status, created_at, updated_at, completed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [DEFAULT_TENANT_ID, '456', 75000, 75200, 'qris', 'qr_xyz', 'completed', now, now, now],
      });

      const result = await runTool(checkPayment, { orderId: 456 });

      expect(result.found).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.amountIdr).toBe(75000);
    });

    it('returns found: false when no payment record', async () => {
      const { createCheckPaymentTool } = await import(
        '../../src/mastra/tools/customer/payment.js'
      );
      const db = getDb();
      const { checkPayment } = createCheckPaymentTool({ db, tenantId: DEFAULT_TENANT_ID });

      const result = await runTool(checkPayment, { orderId: 999 });
      expect(result.found).toBe(false);
    });
  });
});