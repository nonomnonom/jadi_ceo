import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type ExpenseCategoryDeps = { db: Db; tenantId: string };

export function createExpenseCategoryTools({ db, tenantId }: ExpenseCategoryDeps) {
  const listExpenseCategories = createTool({
    id: 'list-expense-categories',
    description: 'Lihat semua kategori pengeluaran.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      categories: z.array(
        z.object({
          id: z.number().int(),
          name: z.string(),
          createdAt: z.number().int(),
        }),
      ),
    }),
    execute: async () => {
      const result = await db.execute({
        sql: 'SELECT id, name, created_at FROM expense_categories WHERE tenant_id = ? ORDER BY name ASC',
        args: [tenantId],
      });
      return {
        categories: result.rows.map((r) => ({
          id: Number(r.id),
          name: String(r.name),
          createdAt: Number(r.created_at),
        })),
      };
    },
  });

  const addExpenseCategory = createTool({
    id: 'add-expense-category',
    description:
      'Tambah kategori pengeluaran baru. Gunakan saat owner mau membuat kategori expense baru.',
    inputSchema: z.object({
      name: z.string().min(1).max(100),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      categoryId: z.number().int().nullable(),
      message: z.string(),
    }),
    execute: async ({ name }) => {
      const now = Date.now();
      try {
        const result = await db.execute({
          sql: 'INSERT INTO expense_categories (tenant_id, name, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id',
          args: [tenantId, name.trim(), now, now],
        });
        const row = result.rows[0];
        return {
          success: true,
          categoryId: row ? Number(row.id) : null,
          message: `Kategori "${name.trim()}" berhasil ditambahkan.`,
        };
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE')) {
          return { success: false, categoryId: null, message: 'Kategori sudah ada.' };
        }
        throw err;
      }
    },
  });

  const deleteExpenseCategory = createTool({
    id: 'delete-expense-category',
    description: 'Hapus kategori pengeluaran.',
    inputSchema: z.object({
      id: z.number().int().positive(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async ({ id }) => {
      const result = await db.execute({
        sql: 'DELETE FROM expense_categories WHERE id = ? AND tenant_id = ? RETURNING id',
        args: [id, tenantId],
      });
      if (result.rows.length === 0) {
        return { success: false, message: 'Kategori tidak ditemukan.' };
      }
      return { success: true, message: 'Kategori berhasil dihapus.' };
    },
  });

  return { listExpenseCategories, addExpenseCategory, deleteExpenseCategory };
}