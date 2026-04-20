import { formatIDR } from '@juragan/shared';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../db/client.js';

export type TransactionToolDeps = { db: Db; tenantId: string };

const TransactionSchema = z.object({
  id: z.number().int(),
  kind: z.enum(['income', 'expense']),
  amountIdr: z.number().int().positive(),
  amountFormatted: z.string(),
  description: z.string().nullable(),
  occurredAt: z.number().int(),
});

function startOfDayMs(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function createTransactionTools({ db, tenantId }: TransactionToolDeps) {
  const logTransaction = createTool({
    id: 'log-transaction',
    description:
      'Catat pemasukan (income) atau pengeluaran (expense) dalam Rupiah. Gunakan ini saat owner bilang "pendapatan hari ini 1.5 juta", "belanja bahan 500rb", atau mencatat transaksi lainnya. Jangan gunakan untuk hal non-finansial (pakai add-note).',
    inputSchema: z.object({
      kind: z.enum(['income', 'expense']),
      amountIdr: z
        .number()
        .int()
        .positive()
        .describe('Jumlah dalam Rupiah (IDR) sebagai integer. Contoh: 1500000 untuk 1.5 juta.'),
      description: z.string().min(1).max(500).optional(),
      occurredAt: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe(
          'Waktu kejadian ISO-8601 (offset diperbolehkan, mis. +07:00). Default: sekarang.',
        ),
    }),
    outputSchema: TransactionSchema,
    execute: async ({ kind, amountIdr, description, occurredAt }) => {
      const occurred = occurredAt ? new Date(occurredAt).getTime() : Date.now();
      const createdAt = Date.now();
      const result = await db.execute({
        sql: 'INSERT INTO transactions (tenant_id, kind, amount_idr, description, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        args: [tenantId, kind, amountIdr, description ?? null, occurred, createdAt],
      });
      const row = result.rows[0];
      if (!row) throw new Error('Gagal mencatat transaksi');
      return {
        id: Number(row.id),
        kind,
        amountIdr,
        amountFormatted: formatIDR(amountIdr),
        description: description ?? null,
        occurredAt: occurred,
      };
    },
  });

  const getDailySummary = createTool({
    id: 'get-daily-summary',
    description:
      'Ringkasan harian owner: total pemasukan, total pengeluaran, laba bersih, jumlah catatan baru, dan jumlah pengingat yang belum selesai. Default hari ini. Gunakan saat owner tanya "gimana hari ini", "laporan hari ini", atau "ringkasan".',
    inputSchema: z.object({
      date: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe('Tanggal (ISO-8601) untuk ringkasan. Default: hari ini waktu Jakarta.'),
    }),
    outputSchema: z.object({
      dayStart: z.number().int(),
      dayEnd: z.number().int(),
      incomeIdr: z.number().int(),
      incomeFormatted: z.string(),
      expenseIdr: z.number().int(),
      expenseFormatted: z.string(),
      netIdr: z.number().int(),
      netFormatted: z.string(),
      noteCount: z.number().int(),
      pendingReminderCount: z.number().int(),
    }),
    execute: async ({ date }) => {
      const base = date ? new Date(date).getTime() : Date.now();
      const dayStart = startOfDayMs(base);
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const txRes = await db.execute({
        sql: 'SELECT kind, COALESCE(SUM(amount_idr), 0) AS total FROM transactions WHERE tenant_id = ? AND occurred_at >= ? AND occurred_at < ? GROUP BY kind',
        args: [tenantId, dayStart, dayEnd],
      });
      let incomeIdr = 0;
      let expenseIdr = 0;
      for (const row of txRes.rows) {
        const total = Number(row.total);
        if (row.kind === 'income') incomeIdr = total;
        else if (row.kind === 'expense') expenseIdr = total;
      }

      const notesRes = await db.execute({
        sql: 'SELECT COUNT(*) AS c FROM notes WHERE tenant_id = ? AND created_at >= ? AND created_at < ?',
        args: [tenantId, dayStart, dayEnd],
      });
      const noteCount = Number(notesRes.rows[0]?.c ?? 0);

      const remRes = await db.execute({
        sql: 'SELECT COUNT(*) AS c FROM reminders WHERE tenant_id = ? AND done = 0',
        args: [tenantId],
      });
      const pendingReminderCount = Number(remRes.rows[0]?.c ?? 0);

      const netIdr = incomeIdr - expenseIdr;
      return {
        dayStart,
        dayEnd,
        incomeIdr,
        incomeFormatted: formatIDR(incomeIdr),
        expenseIdr,
        expenseFormatted: formatIDR(expenseIdr),
        netIdr,
        netFormatted: formatIDR(netIdr),
        noteCount,
        pendingReminderCount,
      };
    },
  });

  return { logTransaction, getDailySummary };
}
