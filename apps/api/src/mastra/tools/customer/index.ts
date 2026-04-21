import { formatIDR } from '@juragan/shared';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';
import { createRequestCancelTool } from './request-cancel.js';
import { createShippingTools } from './track-shipping.js';

export type CustomerToolDeps = { db: Db; tenantId: string };

const ProductSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  priceIdr: z.number().int(),
  priceFormatted: z.string(),
  stockQty: z.number().int(),
});

export function createCustomerTools({ db, tenantId }: CustomerToolDeps) {
  const listProducts = createTool({
    id: 'list-products',
    description:
      'Lihat daftar produk yang bisa dipesan. Gunakan saat customer bertanya produk apa saja yang tersedia.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(20),
    }),
    outputSchema: z.object({ products: z.array(ProductSchema) }),
    execute: async ({ limit }) => {
      const result = await db.execute({
        sql: 'SELECT id, name, price_idr, stock_qty FROM products WHERE tenant_id = ? AND stock_qty > 0 ORDER BY name ASC LIMIT ?',
        args: [tenantId, limit ?? 20],
      });
      return {
        products: result.rows.map((r) => ({
          id: Number(r.id),
          name: String(r.name),
          priceIdr: Number(r.price_idr),
          priceFormatted: formatIDR(Number(r.price_idr)),
          stockQty: Number(r.stock_qty),
        })),
      };
    },
  });

  const createOrder = createTool({
    id: 'create-order',
    description: 'Buat pesanan baru dari customer. Gunakan saat customer mau order produk.',
    inputSchema: z.object({
      productId: z.number().int().positive(),
      qty: z.number().int().min(1),
      customerPhone: z.string().min(6),
    }),
    outputSchema: z.object({
      orderId: z.number().int(),
      status: z.enum(['pending', 'approved', 'rejected', 'paid', 'cancelled']),
      totalIdr: z.number().int(),
      createdAt: z.number().int(),
    }),
    execute: async ({ productId, qty, customerPhone }) => {
      const productResult = await db.execute({
        sql: 'SELECT name, price_idr, stock_qty FROM products WHERE id = ? AND tenant_id = ?',
        args: [productId, tenantId],
      });
      if (productResult.rows.length === 0) {
        throw new Error('Produk tidak ditemukan');
      }
      const product = productResult.rows[0];
      if (!product) {
        throw new Error('Produk tidak ditemukan');
      }
      if (Number(product.stock_qty) < qty) {
        throw new Error('Stok tidak cukup');
      }
      const totalIdr = Number(product.price_idr) * qty;
      const now = Date.now();
      const insertResult = await db.execute({
        sql: `INSERT INTO orders (tenant_id, customer_phone, product_id, qty, total_idr, status, payment_status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?) RETURNING id`,
        args: [tenantId, customerPhone, productId, qty, totalIdr, now, now],
      });
      const insertedRow = insertResult.rows[0];
      if (!insertedRow) throw new Error('Gagal membuat pesanan');
      const orderId = Number(insertedRow.id);
      return { orderId, status: 'pending' as const, totalIdr, createdAt: now };
    },
  });

  const checkOrder = createTool({
    id: 'check-order',
    description: 'Cek status pesanan berdasarkan ID order.',
    inputSchema: z.object({
      orderId: z.number().int().positive(),
    }),
    outputSchema: z.object({
      orderId: z.number().int(),
      status: z.enum(['pending', 'approved', 'rejected', 'paid', 'cancelled']),
      paymentStatus: z.enum(['unpaid', 'paid', 'cancelled']),
      totalIdr: z.number().int(),
      createdAt: z.number().int(),
    }),
    execute: async ({ orderId }) => {
      const result = await db.execute({
        sql: 'SELECT id, status, payment_status, total_idr, created_at FROM orders WHERE id = ? AND tenant_id = ?',
        args: [orderId, tenantId],
      });
      if (result.rows.length === 0) {
        throw new Error('Order tidak ditemukan');
      }
      const row = result.rows[0];
      if (!row) throw new Error('Order tidak ditemukan');
      return {
        orderId: Number(row.id),
        status: row.status as 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled',
        paymentStatus: row.payment_status as 'unpaid' | 'paid' | 'cancelled',
        totalIdr: Number(row.total_idr),
        createdAt: Number(row.created_at),
      };
    },
  });

  const { requestCancel, getOrderTracking } = createRequestCancelTool({ db, tenantId });
  const { trackShipping, requestShipping } = createShippingTools({ db, tenantId });

  return {
    listProducts,
    createOrder,
    checkOrder,
    requestCancel,
    getOrderTracking,
    trackShipping,
    requestShipping,
  };
}
