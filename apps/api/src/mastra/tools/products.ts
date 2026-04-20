import { formatIDR } from '@juragan/shared';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../db/client.js';

export type ProductToolDeps = { db: Db; tenantId: string };

const ProductSchema = z.object({
  id: z.number().int(),
  sku: z.string().nullable(),
  name: z.string(),
  priceIdr: z.number().int(),
  priceFormatted: z.string(),
  stockQty: z.number().int(),
  lowStockAt: z.number().int(),
  isLowStock: z.boolean(),
});

export function createProductTools({ db, tenantId }: ProductToolDeps) {
  const addProduct = createTool({
    id: 'add-product',
    description:
      'Tambah produk/jasa ke katalog: nama, harga Rupiah, stok awal, dan ambang low-stock (alert kalau stok <= angka ini). SKU opsional. Gunakan saat owner bilang "tambah barang", "produk baru", "jasa baru".',
    inputSchema: z.object({
      name: z.string().min(1).max(200),
      priceIdr: z
        .number()
        .int()
        .min(0)
        .describe('Harga dalam Rupiah (integer). Gunakan 0 untuk jasa/produk tanpa harga tetap.'),
      stockQty: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe('Stok awal. Default 0. Untuk jasa, biarkan 0.'),
      lowStockAt: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe(
          'Ambang low-stock. Kalau stok <= ini, dianggap hampir habis. Default 0 (tidak dipantau).',
        ),
      sku: z.string().max(60).optional(),
    }),
    outputSchema: ProductSchema,
    execute: async ({ name, priceIdr, stockQty, lowStockAt, sku }) => {
      const stock = stockQty ?? 0;
      const threshold = lowStockAt ?? 0;
      const now = Date.now();
      const result = await db.execute({
        sql: 'INSERT INTO products (tenant_id, sku, name, price_idr, stock_qty, low_stock_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
        args: [tenantId, sku ?? null, name, priceIdr, stock, threshold, now, now],
      });
      const row = result.rows[0];
      if (!row) throw new Error('Gagal menyimpan produk');
      return {
        id: Number(row.id),
        sku: sku ?? null,
        name,
        priceIdr,
        priceFormatted: formatIDR(priceIdr),
        stockQty: stock,
        lowStockAt: threshold,
        isLowStock: threshold > 0 && stock <= threshold,
      };
    },
  });

  const listProducts = createTool({
    id: 'list-products',
    description:
      'Lihat katalog produk. Bisa filter ke produk yang hampir habis dengan lowStockOnly=true. Bisa search nama (substring, case-insensitive). Gunakan saat owner tanya "apa aja produknya", "stok apa yang mau habis", "produk X ada?".',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(20),
      lowStockOnly: z.boolean().default(false),
      search: z.string().min(1).max(200).optional(),
    }),
    outputSchema: z.object({ products: z.array(ProductSchema) }),
    execute: async ({ limit, lowStockOnly, search }) => {
      const lim = limit ?? 20;
      const onlyLow = lowStockOnly ?? false;
      const clauses: string[] = ['tenant_id = ?'];
      const args: (string | number)[] = [tenantId];
      if (onlyLow) {
        clauses.push('low_stock_at > 0');
        clauses.push('stock_qty <= low_stock_at');
      }
      if (search) {
        clauses.push('LOWER(name) LIKE ?');
        args.push(`%${search.toLowerCase()}%`);
      }
      args.push(lim);
      const sql = `SELECT id, sku, name, price_idr, stock_qty, low_stock_at FROM products WHERE ${clauses.join(' AND ')} ORDER BY name ASC LIMIT ?`;
      const result = await db.execute({ sql, args });
      return {
        products: result.rows.map((r) => {
          const priceIdr = Number(r.price_idr);
          const stockQty = Number(r.stock_qty);
          const lowStockAt = Number(r.low_stock_at);
          return {
            id: Number(r.id),
            sku: r.sku == null ? null : String(r.sku),
            name: String(r.name),
            priceIdr,
            priceFormatted: formatIDR(priceIdr),
            stockQty,
            lowStockAt,
            isLowStock: lowStockAt > 0 && stockQty <= lowStockAt,
          };
        }),
      };
    },
  });

  const adjustStock = createTool({
    id: 'adjust-stock',
    description:
      'Ubah stok produk dengan delta (+ untuk masuk/restock, - untuk keluar/terjual/rusak). Wajib kasih reason ("restock dari supplier X", "terjual 5", "rusak 2"). Gunakan saat owner bilang "tambah stok", "stok keluar", "barang rusak". JANGAN set nilai absolut — selalu pakai delta.',
    inputSchema: z.object({
      productId: z.number().int().positive(),
      delta: z
        .number()
        .int()
        .describe('Perubahan stok. Positif untuk masuk, negatif untuk keluar. TIDAK boleh nol.'),
      reason: z.string().min(1).max(200),
    }),
    outputSchema: z.object({
      productId: z.number().int(),
      name: z.string(),
      previousStock: z.number().int(),
      delta: z.number().int(),
      newStock: z.number().int(),
      reason: z.string(),
      isLowStock: z.boolean(),
    }),
    execute: async ({ productId, delta, reason }) => {
      if (delta === 0) throw new Error('Delta stok tidak boleh 0');
      const productRes = await db.execute({
        sql: 'SELECT name, stock_qty, low_stock_at FROM products WHERE tenant_id = ? AND id = ?',
        args: [tenantId, productId],
      });
      const product = productRes.rows[0];
      if (!product) throw new Error(`Produk id ${productId} tidak ditemukan`);
      const previousStock = Number(product.stock_qty);
      const lowStockAt = Number(product.low_stock_at);
      const newStock = previousStock + delta;
      if (newStock < 0) {
        throw new Error(
          `Stok tidak boleh negatif (${previousStock} ${delta >= 0 ? '+' : ''}${delta} = ${newStock})`,
        );
      }
      const now = Date.now();
      await db.execute({
        sql: 'UPDATE products SET stock_qty = ?, updated_at = ? WHERE tenant_id = ? AND id = ?',
        args: [newStock, now, tenantId, productId],
      });
      await db.execute({
        sql: 'INSERT INTO stock_movements (tenant_id, product_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [tenantId, productId, delta, reason, now],
      });
      return {
        productId,
        name: String(product.name),
        previousStock,
        delta,
        newStock,
        reason,
        isLowStock: lowStockAt > 0 && newStock <= lowStockAt,
      };
    },
  });

  return { addProduct, listProducts, adjustStock };
}
