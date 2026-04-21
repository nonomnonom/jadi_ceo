import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { setSetting } from '../../src/db/settings.js';
import { runTool } from '../run-tool.js';

describe('invoiceOrder tool', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
    // Set up required settings
    await setSetting(db, DEFAULT_TENANT_ID, 'customerAgentEnabled' as any, 'true');
    await setSetting(db, DEFAULT_TENANT_ID, 'pakasirProject' as any, 'test-project');
    await setSetting(db, DEFAULT_TENANT_ID, 'pakasirApiKey' as any, 'test-api-key');
    await setSetting(db, DEFAULT_TENANT_ID, 'rajaongkirApiKey' as any, 'test-api-key');
    // Insert a test product
    await db.execute({
      sql: `INSERT INTO products (tenant_id, name, price_idr, stock_qty, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [DEFAULT_TENANT_ID, 'Kopi Hitam', 15000, 50, Date.now(), Date.now()],
    });
    vi.clearAllMocks();
  });

  it('creates order with pending status when auto_process is disabled', async () => {
    const db = getDb();
    await setSetting(db, DEFAULT_TENANT_ID, 'autoProcessOrders' as any, 'false');

    const { createInvoiceOrderTool } = await import('../../src/mastra/tools/customer/invoice-order.js');
    const { invoiceOrder } = createInvoiceOrderTool({ db, tenantId: DEFAULT_TENANT_ID });

    // Mock Rajaongkir shipping cost
    vi.stubGlobal('fetch', async (url: URL) => {
      if (url.toString().includes('cost')) {
        return {
          ok: true,
          json: async () => ({
            rajaongkir: {
              results: [{
                courier: 'JNE',
                costs: [{
                  service: 'REG',
                  cost: [{ value: 15000, etd: '2-3', note: '' }],
                }],
              }],
            },
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const result = await runTool(invoiceOrder, {
      productId: 1,
      qty: 2,
      customerPhone: '+6281234567890',
      originCityId: '1',
      destinationCityId: '5',
      courier: 'jne',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.orderId).toBeDefined();
    expect(result.needsApproval).toBe(true); // auto_process is false
    expect(result.shippingCost).toBe(15000);
    expect(result.totalAmount).toBe(45000); // 30000 product + 15000 shipping
  });

  it('auto-approves and requests payment when auto_process is enabled', async () => {
    const db = getDb();
    await setSetting(db, DEFAULT_TENANT_ID, 'autoProcessOrders' as any, 'true');

    const { createInvoiceOrderTool } = await import('../../src/mastra/tools/customer/invoice-order.js');
    const { invoiceOrder } = createInvoiceOrderTool({ db, tenantId: DEFAULT_TENANT_ID });

    vi.stubGlobal('fetch', async (url: URL) => {
      if (url.toString().includes('cost')) {
        return {
          ok: true,
          json: async () => ({
            rajaongkir: {
              results: [{
                courier: 'JNE',
                costs: [{
                  service: 'REG',
                  cost: [{ value: 12000, etd: '2-3', note: '' }],
                }],
              }],
            },
          }),
        };
      }
      if (url.toString().includes('transactioncreate')) {
        return {
          ok: true,
          json: async () => ({
            payment: {
              project: 'test-project',
              order_id: '1',
              amount: 42000,
              fee: 500,
              total_payment: 42500,
              payment_method: 'qris',
              payment_number: 'QR123',
              expired_at: '2024-09-10T10:00:00+07:00',
            },
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const result = await runTool(invoiceOrder, {
      productId: 1,
      qty: 2,
      customerPhone: '+6281234567890',
      originCityId: '1',
      destinationCityId: '5',
      courier: 'jne',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('approved');
    expect(result.needsApproval).toBe(false);
    expect(result.paymentRequest).toBeDefined();
    expect(result.paymentRequest?.qrImage).toBeDefined();
  });

  it('throws when stock is insufficient', async () => {
    const db = getDb();
    const { createInvoiceOrderTool } = await import('../../src/mastra/tools/customer/invoice-order.js');
    const { invoiceOrder } = createInvoiceOrderTool({ db, tenantId: DEFAULT_TENANT_ID });

    await expect(runTool(invoiceOrder, {
      productId: 1,
      qty: 100, // More than available stock (50)
      customerPhone: '+6281234567890',
      originCityId: '1',
      destinationCityId: '5',
      courier: 'jne',
    })).rejects.toThrow('Stok tidak cukup');
  });

  it('throws when product not found', async () => {
    const db = getDb();
    const { createInvoiceOrderTool } = await import('../../src/mastra/tools/customer/invoice-order.js');
    const { invoiceOrder } = createInvoiceOrderTool({ db, tenantId: DEFAULT_TENANT_ID });

    await expect(runTool(invoiceOrder, {
      productId: 999,
      qty: 1,
      customerPhone: '+6281234567890',
      originCityId: '1',
      destinationCityId: '5',
      courier: 'jne',
    })).rejects.toThrow('Produk tidak ditemukan');
  });
});
