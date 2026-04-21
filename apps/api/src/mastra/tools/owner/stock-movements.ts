import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type StockMovementsDeps = { db: Db; tenantId: string };

export function createStockMovementTools({ db, tenantId }: StockMovementsDeps) {
  const listStockMovements = createTool({
    id: 'list-stock-movements',
    description:
      'Riwayat pergerakan stok produk. Menampilkan perubahan stok (penambahan/pengurangan) dalam periode tertentu.',
    inputSchema: z.object({
      productId: z.number().int().positive().optional(),
      days: z.number().int().min(1).max(90).default(30),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    outputSchema: z.object({
      movements: z.array(
        z.object({
          id: z.number().int(),
          productId: z.number().int(),
          productName: z.string(),
          delta: z.number().int(),
          reason: z.string().nullable(),
          createdAt: z.number().int(),
        }),
      ),
    }),
    execute: async ({ productId, days = 30, limit = 50 }) => {
      const since = Date.now() - days * 24 * 60 * 60 * 1000;

      const clauses = ['sm.tenant_id = ?', 'sm.created_at >= ?'];
      const args: (string | number)[] = [tenantId, since];

      if (productId) {
        clauses.push('sm.product_id = ?');
        args.push(productId);
      }

      args.push(limit);

      const result = await db.execute({
        sql: `SELECT sm.id, sm.product_id, p.name as product_name, sm.delta, sm.reason, sm.created_at
              FROM stock_movements sm
              JOIN products p ON sm.product_id = p.id
              WHERE ${clauses.join(' AND ')}
              ORDER BY sm.created_at DESC
              LIMIT ?`,
        args,
      });

      return {
        movements: result.rows.map((r) => ({
          id: Number(r.id),
          productId: Number(r.product_id),
          productName: String(r.product_name),
          delta: Number(r.delta),
          reason: r.reason ? String(r.reason) : null,
          createdAt: Number(r.created_at),
        })),
      };
    },
  });

  const getProductStockSummary = createTool({
    id: 'get-product-stock-summary',
    description:
      'Ringkasan stok semua produk. Tampilkan nama, stok saat ini, dan category.',
    inputSchema: z.object({
      lowStockThreshold: z.number().int().default(10).describe('Tampilkan produk dengan stok <= threshold'),
      categoryId: z.number().int().positive().optional(),
    }),
    outputSchema: z.object({
      products: z.array(
        z.object({
          id: z.number().int(),
          name: z.string(),
          stockQty: z.number().int(),
          priceIdr: z.number().int(),
          priceFormatted: z.string(),
          isLowStock: z.boolean(),
        }),
      ),
      lowStockCount: z.number().int(),
      totalProducts: z.number().int(),
    }),
    execute: async ({ lowStockThreshold = 10, categoryId }) => {
      const clauses = ['tenant_id = ?'];
      const args: (string | number)[] = [tenantId];

      if (categoryId) {
        clauses.push('category_id = ?');
        args.push(categoryId);
      }

      const result = await db.execute({
        sql: `SELECT id, name, stock_qty, price_idr FROM products WHERE ${clauses.join(' AND ')} ORDER BY name ASC`,
        args,
      });

      const products = result.rows.map((r) => {
        const stockQty = Number(r.stock_qty);
        const priceIdr = Number(r.price_idr);
        return {
          id: Number(r.id),
          name: String(r.name),
          stockQty,
          priceIdr,
          priceFormatted: `Rp ${priceIdr.toLocaleString('id-ID')}`,
          isLowStock: stockQty <= lowStockThreshold,
        };
      });

      return {
        products,
        lowStockCount: products.filter((p) => p.isLowStock).length,
        totalProducts: products.length,
      };
    },
  });

  return { listStockMovements, getProductStockSummary };
}