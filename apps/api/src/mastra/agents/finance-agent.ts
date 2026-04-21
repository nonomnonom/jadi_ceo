import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { Agent } from '@mastra/core/agent';
import { getDb } from '../../db/client.js';
import { createTransactionTools } from '../tools/transactions.js';

const db = getDb();
const { logTransaction, getDailySummary } = createTransactionTools({ db, tenantId });

const instructions = `
Kamu adalah asisten pembukuan untuk owner bisnis Indonesia.
Gunakan tool yang tersedia untuk mencatat transaksi dan melihat ringkasan.

- log-transaction: catat income (pemasukan) atau expense (pengeluaran) dalam Rupiah.
  Gunakan saat owner bilang angka finanasial ("pendapatan 1.5 juta", "beli bahan 500rb").
- get-daily-summary: lihat ringkasan harian (income, expense, net).

Gaya: Bahasa Indonesia casual, singkat, langsung ke angka.
`.trim();

export const financeAgent = new Agent({
  id: 'finance-agent',
  name: 'Finance Agent',
  description:
    'Pembukuan Income/expense, ringkasan harian. Gunakan untuk log-transaction (catat transaksi) dan get-daily-summary (ringkasan harian).',
  instructions,
  model: 'openrouter/anthropic/claude-sonnet-4-6',
  tools: { logTransaction, getDailySummary },
});
