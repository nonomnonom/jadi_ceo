import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { createProductTools } from '../../src/mastra/tools/products.js';
import { runTool } from '../run-tool.js';

const TENANT = 'test-tenant';

let db: Db;
let tools: ReturnType<typeof createProductTools>;

beforeEach(async () => {
  db = createDb(':memory:');
  await initSchema(db);
  tools = createProductTools({ db, tenantId: TENANT });
});

describe('addProduct', () => {
  it('stores a product with SKU and returns formatted price', async () => {
    const result = await runTool(tools.addProduct, {
      name: 'Sabun Batang',
      priceIdr: 15000,
      stockQty: 100,
      lowStockAt: 20,
      sku: 'SBN-001',
    });
    expect(result.id).toBeGreaterThan(0);
    expect(result.name).toBe('Sabun Batang');
    expect(result.priceFormatted).toBe('Rp 15.000');
    expect(result.stockQty).toBe(100);
    expect(result.isLowStock).toBe(false);
    expect(result.sku).toBe('SBN-001');
  });

  it('defaults stock and low-stock threshold to 0; marks low-stock only when threshold > 0', async () => {
    const result = await runTool(tools.addProduct, { name: 'Jasa Setrika', priceIdr: 0 });
    expect(result.stockQty).toBe(0);
    expect(result.lowStockAt).toBe(0);
    expect(result.isLowStock).toBe(false);
    expect(result.sku).toBeNull();
  });

  it('flags isLowStock immediately when initial stock is at/below threshold', async () => {
    const result = await runTool(tools.addProduct, {
      name: 'Kopi Kiloan',
      priceIdr: 120000,
      stockQty: 3,
      lowStockAt: 5,
    });
    expect(result.isLowStock).toBe(true);
  });
});

describe('listProducts', () => {
  it('sorts alphabetically and honors limit', async () => {
    await runTool(tools.addProduct, { name: 'Cuka', priceIdr: 5000 });
    await runTool(tools.addProduct, { name: 'Apel', priceIdr: 8000 });
    await runTool(tools.addProduct, { name: 'Belimbing', priceIdr: 10000 });
    const { products } = await runTool(tools.listProducts, { limit: 2 });
    expect(products.map((p) => p.name)).toEqual(['Apel', 'Belimbing']);
  });

  it('filters lowStockOnly using the per-product threshold', async () => {
    await runTool(tools.addProduct, {
      name: 'Stok Banyak',
      priceIdr: 1000,
      stockQty: 100,
      lowStockAt: 10,
    });
    await runTool(tools.addProduct, {
      name: 'Mau Habis',
      priceIdr: 1000,
      stockQty: 2,
      lowStockAt: 5,
    });
    await runTool(tools.addProduct, {
      name: 'Tak Dipantau',
      priceIdr: 1000,
      stockQty: 0,
      lowStockAt: 0,
    });
    const { products } = await runTool(tools.listProducts, { limit: 10, lowStockOnly: true });
    expect(products).toHaveLength(1);
    expect(products[0]?.name).toBe('Mau Habis');
  });

  it('searches by case-insensitive substring', async () => {
    await runTool(tools.addProduct, { name: 'Sabun Batang', priceIdr: 15000 });
    await runTool(tools.addProduct, { name: 'Sabun Cair', priceIdr: 25000 });
    await runTool(tools.addProduct, { name: 'Pasta Gigi', priceIdr: 12000 });
    const { products } = await runTool(tools.listProducts, { limit: 10, search: 'SABUN' });
    expect(products).toHaveLength(2);
    expect(products.map((p) => p.name).sort()).toEqual(['Sabun Batang', 'Sabun Cair']);
  });
});

describe('adjustStock', () => {
  it('increases stock and returns previous/new values', async () => {
    const p = await runTool(tools.addProduct, { name: 'Beras', priceIdr: 15000, stockQty: 50 });
    const adj = await runTool(tools.adjustStock, {
      productId: p.id,
      delta: 25,
      reason: 'restock dari supplier Pak Budi',
    });
    expect(adj.previousStock).toBe(50);
    expect(adj.delta).toBe(25);
    expect(adj.newStock).toBe(75);
  });

  it('decreases stock for sales', async () => {
    const p = await runTool(tools.addProduct, {
      name: 'Mie',
      priceIdr: 3000,
      stockQty: 10,
      lowStockAt: 5,
    });
    const adj = await runTool(tools.adjustStock, { productId: p.id, delta: -7, reason: 'terjual' });
    expect(adj.newStock).toBe(3);
    expect(adj.isLowStock).toBe(true);
  });

  it('rejects going negative', async () => {
    const p = await runTool(tools.addProduct, { name: 'Telur', priceIdr: 2000, stockQty: 5 });
    await expect(
      runTool(tools.adjustStock, { productId: p.id, delta: -10, reason: 'terjual' }),
    ).rejects.toThrow(/negatif/);
  });

  it('rejects unknown product', async () => {
    await expect(
      runTool(tools.adjustStock, { productId: 9999, delta: 1, reason: 'x' }),
    ).rejects.toThrow(/tidak ditemukan/);
  });
});
