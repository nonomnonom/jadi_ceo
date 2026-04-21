import { formatIDR } from '@juragan/shared';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type CashflowReportDeps = { db: Db; tenantId: string };

function startOfDayMs(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function createCashflowReportTools({ db, tenantId }: CashflowReportDeps) {
  const getCashflowReport = createTool({
    id: 'get-cashflow-report',
    description:
      'Laporan arus kas: pemasukan, pengeluaran, dan saldo bersih dalam periode tertentu. Default 7 hari.',
    inputSchema: z.object({
      days: z.number().int().min(1).max(90).default(7).describe('Jumlah hari ke belakang'),
      startDate: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe('Tanggal mulai (ISO-8601). Default: [days] hari lalu.'),
    }),
    outputSchema: z.object({
      periodStart: z.number().int(),
      periodEnd: z.number().int(),
      totalIncomeIdr: z.number().int(),
      totalIncomeFormatted: z.string(),
      totalExpenseIdr: z.number().int(),
      totalExpenseFormatted: z.string(),
      netIdr: z.number().int(),
      netFormatted: z.string(),
      transactionCount: z.number().int(),
      dailyBreakdown: z.array(
        z.object({
          day: z.string(),
          dayFormatted: z.string(),
          incomeIdr: z.number().int(),
          expenseIdr: z.number().int(),
          netIdr: z.number().int(),
        }),
      ),
    }),
    execute: async ({ days = 7, startDate }) => {
      const endMs = Date.now();
      const startMs = startDate
        ? new Date(startDate).getTime()
        : endMs - days * 24 * 60 * 60 * 1000;

      const periodStart = startOfDayMs(startMs);
      const periodEnd = startOfDayMs(endMs) + 24 * 60 * 60 * 1000;

      // Get totals
      const totalsRes = await db.execute({
        sql: `SELECT kind, COALESCE(SUM(amount_idr), 0) as total
              FROM transactions
              WHERE tenant_id = ? AND occurred_at >= ? AND occurred_at < ?
              GROUP BY kind`,
        args: [tenantId, periodStart, periodEnd],
      });

      let totalIncomeIdr = 0;
      let totalExpenseIdr = 0;
      for (const row of totalsRes.rows) {
        if (row.kind === 'income') totalIncomeIdr = Number(row.total);
        else if (row.kind === 'expense') totalExpenseIdr = Number(row.total);
      }

      // Get daily breakdown
      const dailyRes = await db.execute({
        sql: `SELECT
                date(occurred_at/1000, 'unixepoch') as day,
                kind,
                SUM(amount_idr) as total
              FROM transactions
              WHERE tenant_id = ? AND occurred_at >= ? AND occurred_at < ?
              GROUP BY day, kind
              ORDER BY day ASC`,
        args: [tenantId, periodStart, periodEnd],
      });

      const byDay: Record<string, { income: number; expense: number }> = {};
      for (const row of dailyRes.rows) {
        const day = String(row.day);
        if (!byDay[day]) byDay[day] = { income: 0, expense: 0 };
        if (row.kind === 'income') byDay[day].income = Number(row.total);
        else byDay[day].expense = Number(row.total);
      }

      const dailyBreakdown: { day: string; dayFormatted: string; incomeIdr: number; expenseIdr: number; netIdr: number }[] = [];
      for (const [day, vals] of Object.entries(byDay).sort()) {
        const d = new Date(day);
        dailyBreakdown.push({
          day,
          dayFormatted: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
          incomeIdr: vals.income,
          expenseIdr: vals.expense,
          netIdr: vals.income - vals.expense,
        });
      }

      const netIdr = totalIncomeIdr - totalExpenseIdr;

      return {
        periodStart,
        periodEnd,
        totalIncomeIdr,
        totalIncomeFormatted: formatIDR(totalIncomeIdr),
        totalExpenseIdr,
        totalExpenseFormatted: formatIDR(totalExpenseIdr),
        netIdr,
        netFormatted: formatIDR(netIdr),
        transactionCount: dailyRes.rows.length,
        dailyBreakdown,
      };
    },
  });

  return { getCashflowReport };
}