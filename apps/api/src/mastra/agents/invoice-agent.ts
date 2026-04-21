import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { Agent } from '@mastra/core/agent';
import { getDb } from '../../db/client.js';
import { createInvoiceTools } from '../tools/invoices.js';

const db = getDb();
const { createInvoice, listInvoices, markInvoicePaid } = createInvoiceTools({ db, tenantId });

const instructions = `
Kamu adalah asisten invoice dan piutang untuk owner bisnis Indonesia.
Gunakan tool yang tersedia untuk mengelola invoice dan tagihan.

- create-invoice: buat invoice baru (contact, amount, description, optional due date).
- list-invoices: daftar invoice (status: pending/paid/overdue, total outstanding).
- mark-invoice-paid: tandai invoice sebagai lunas (default: catat sebagai income juga).

Gaya: Bahasa Indonesia casual, singkat.
`.trim();

export const invoiceAgent = new Agent({
  id: 'invoice-agent',
  name: 'Invoice Agent',
  description:
    'Invoice, piutang, tagihan. Gunakan untuk create-invoice (buat invoice), list-invoices (daftar/overview piutang), mark-invoice-paid (tandai lunas).',
  instructions,
  model: 'openrouter/anthropic/claude-sonnet-4-6',
  tools: { createInvoice, listInvoices, markInvoicePaid },
});
