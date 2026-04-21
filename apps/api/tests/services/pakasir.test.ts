import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { setSetting } from '../../src/db/settings.js';

describe('PakasirService', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
    // Save fake credentials for test isolation
    await setSetting(db, DEFAULT_TENANT_ID, 'pakasirProject' as any, 'test-project');
    await setSetting(db, DEFAULT_TENANT_ID, 'pakasirApiKey' as any, 'test-api-key');
    vi.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('calls Pakasir API with correct parameters', async () => {
      const { PakasirService } = await import('../../src/services/pakasir.js');
      const db = getDb();
      const service = new PakasirService({ db, tenantId: DEFAULT_TENANT_ID });

      // Mock fetch to capture the request
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          payment: {
            project: 'test-project',
            order_id: 'ORD-001',
            amount: 50000,
            fee: 200,
            total_payment: 50200,
            payment_method: 'qris',
            payment_number: 'qr_abc123',
            expired_at: '2024-09-10T10:00:00+07:00',
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await service.createTransaction({
        orderId: 'ORD-001',
        amount: 50000,
        method: 'qris',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.pakasir.com/api/transactioncreate/qris',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            project: 'test-project',
            order_id: 'ORD-001',
            amount: 50000,
            api_key: 'test-api-key',
          }),
        }),
      );
      expect(result.payment.orderId).toBe('ORD-001');
      expect(result.payment.paymentMethod).toBe('qris');
      expect(result.payment.status).toBe('pending');
    });

    it('throws on API error response', async () => {
      const { PakasirService } = await import('../../src/services/pakasir.js');
      const db = getDb();
      const service = new PakasirService({ db, tenantId: DEFAULT_TENANT_ID });

      vi.stubGlobal('fetch', async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid request' }),
      }));

      await expect(
        service.createTransaction({ orderId: 'ORD-001', amount: 50000, method: 'qris' }),
      ).rejects.toThrow('Pakasir API error');
    });

    it('throws when credentials are not configured', async () => {
      const { PakasirService } = await import('../../src/services/pakasir.js');
      const db = getDb();
      // Clear credentials
      await setSetting(db, DEFAULT_TENANT_ID, 'pakasirProject' as any, null);
      await setSetting(db, DEFAULT_TENANT_ID, 'pakasirApiKey' as any, null);

      const service = new PakasirService({ db, tenantId: DEFAULT_TENANT_ID });
      await expect(
        service.createTransaction({ orderId: 'ORD-001', amount: 50000, method: 'qris' }),
      ).rejects.toThrow('Pakasir credentials not configured');
    });
  });

  describe('checkPaymentStatus', () => {
    it('returns payment record from local DB', async () => {
      const { PakasirService } = await import('../../src/services/pakasir.js');
      const db = getDb();
      const service = new PakasirService({ db, tenantId: DEFAULT_TENANT_ID });

      // Insert a payment record directly
      const now = Date.now();
      await db.execute({
        sql: `INSERT INTO payments (tenant_id, order_id, amount_idr, total_payment, payment_method, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [DEFAULT_TENANT_ID, 'ORD-002', 75000, 75200, 'qris', 'pending', now, now],
      });

      const status = await service.checkPaymentStatus('ORD-002');
      expect(status?.orderId).toBe('ORD-002');
      expect(status?.status).toBe('pending');
      expect(status?.amountIdr).toBe(75000);
    });

    it('returns null when no payment record found', async () => {
      const { PakasirService } = await import('../../src/services/pakasir.js');
      const db = getDb();
      const service = new PakasirService({ db, tenantId: DEFAULT_TENANT_ID });

      const status = await service.checkPaymentStatus('NON-EXISTENT');
      expect(status).toBeNull();
    });
  });

  describe('simulatePayment (sandbox)', () => {
    it('simulates a successful payment for testing', async () => {
      const { PakasirService } = await import('../../src/services/pakasir.js');
      const db = getDb();
      const service = new PakasirService({ db, tenantId: DEFAULT_TENANT_ID });

      // Create a pending payment
      const now = Date.now();
      await db.execute({
        sql: `INSERT INTO payments (tenant_id, order_id, amount_idr, total_payment, payment_method, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [DEFAULT_TENANT_ID, 'ORD-003', 30000, 30200, 'qris', 'pending', now, now],
      });

      // Simulate payment via Pakasir sandbox API
      vi.stubGlobal('fetch', async () => ({
        ok: true,
        json: async () => ({ success: true }),
      }));

      await service.simulatePayment('ORD-003');

      // Check DB was updated
      const row = await db.execute({
        sql: "SELECT status FROM payments WHERE order_id = 'ORD-003'",
        args: [],
      });
      expect(row.rows[0]?.status).toBe('completed');
    });
  });
});