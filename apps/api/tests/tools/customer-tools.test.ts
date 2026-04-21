import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { runTool } from '../run-tool.js';

describe('customer tools', () => {
  beforeAll(async () => {
    const db = getDb();
    await initSchema(db);
    await db.execute({
      sql: `INSERT INTO products (tenant_id, name, price_idr, stock_qty, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [DEFAULT_TENANT_ID, 'Kopi Hitam', 15000, 50, Date.now(), Date.now()],
    });
  });

  describe('createOrder', () => {
    it('creates an order and returns order details', async () => {
      const db = getDb();
      const products = await db.execute({
        sql: "SELECT id FROM products WHERE tenant_id = ? AND name = 'Kopi Hitam' LIMIT 1",
        args: [DEFAULT_TENANT_ID],
      });
      const productId = Number(products.rows[0]!.id);

      const { createCustomerTools } = await import('../../src/mastra/tools/customer/index.js');
      const { createOrder } = createCustomerTools({ db, tenantId: DEFAULT_TENANT_ID });

      const result = await runTool(createOrder, {
        productId,
        qty: 2,
        customerPhone: '+6281234567890',
      });

      expect(result.orderId).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.totalIdr).toBe(30000);
    });
  });

  describe('listProducts (customer read-only)', () => {
    it('lists products for the customer', async () => {
      const db = getDb();
      const { createCustomerTools } = await import('../../src/mastra/tools/customer/index.js');
      const { listProducts } = createCustomerTools({ db, tenantId: DEFAULT_TENANT_ID });

      const result = await runTool(listProducts, {});
      expect(result.products.length).toBeGreaterThan(0);
      const kopi = result.products.find((p: { name: string }) => p.name === 'Kopi Hitam');
      expect(kopi).toBeDefined();
      expect(kopi!.priceFormatted).toBe('Rp 15.000');
    });
  });
});
