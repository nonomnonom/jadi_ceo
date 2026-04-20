import { formatIDR } from '@juragan/shared';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../db/client.js';

export type InvoiceToolDeps = { db: Db; tenantId: string };

const InvoiceStatusSchema = z.enum(['pending', 'paid', 'overdue']);

const InvoiceSchema = z.object({
  id: z.number().int(),
  contactId: z.number().int().nullable(),
  contactName: z.string().nullable(),
  amountIdr: z.number().int(),
  amountFormatted: z.string(),
  description: z.string().nullable(),
  dueAt: z.number().int().nullable(),
  paidAt: z.number().int().nullable(),
  status: InvoiceStatusSchema,
  createdAt: z.number().int(),
});

function computeStatus(
  dueAt: number | null,
  paidAt: number | null,
  now: number,
): z.infer<typeof InvoiceStatusSchema> {
  if (paidAt != null) return 'paid';
  if (dueAt != null && dueAt < now) return 'overdue';
  return 'pending';
}

export function createInvoiceTools({ db, tenantId }: InvoiceToolDeps) {
  const createInvoice = createTool({
    id: 'create-invoice',
    description:
      'Buat tagihan (invoice) untuk customer atau pihak lain. ContactId opsional (misal jual one-off tanpa tracking customer). DueAt opsional — kalau owner sebut "tagih 7 hari lagi", panggil get-current-time dulu lalu hitung ISO nya. Default status: pending. Gunakan saat owner bilang "bikin invoice", "tagih X Rp Y", "piutang baru".',
    inputSchema: z.object({
      contactId: z.number().int().positive().optional(),
      amountIdr: z.number().int().positive(),
      description: z.string().min(1).max(500).optional(),
      dueAt: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe('Jatuh tempo ISO-8601 dengan offset. Contoh: "2026-05-01T23:59:59+07:00".'),
    }),
    outputSchema: InvoiceSchema,
    execute: async ({ contactId, amountIdr, description, dueAt }) => {
      let contactName: string | null = null;
      if (contactId != null) {
        const contactRes = await db.execute({
          sql: 'SELECT name FROM contacts WHERE tenant_id = ? AND id = ?',
          args: [tenantId, contactId],
        });
        const contact = contactRes.rows[0];
        if (!contact) throw new Error(`Kontak id ${contactId} tidak ditemukan`);
        contactName = String(contact.name);
      }
      const dueMs = dueAt ? new Date(dueAt).getTime() : null;
      const now = Date.now();
      const result = await db.execute({
        sql: 'INSERT INTO invoices (tenant_id, contact_id, amount_idr, description, due_at, paid_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?) RETURNING id',
        args: [tenantId, contactId ?? null, amountIdr, description ?? null, dueMs, now],
      });
      const row = result.rows[0];
      if (!row) throw new Error('Gagal membuat invoice');
      return {
        id: Number(row.id),
        contactId: contactId ?? null,
        contactName,
        amountIdr,
        amountFormatted: formatIDR(amountIdr),
        description: description ?? null,
        dueAt: dueMs,
        paidAt: null,
        status: computeStatus(dueMs, null, now),
        createdAt: now,
      };
    },
  });

  const listInvoices = createTool({
    id: 'list-invoices',
    description:
      'Lihat invoice. Default: semua pending+overdue (yang belum dibayar). Filter status: pending | paid | overdue. Filter contactId untuk invoice dari satu customer. Overdue otomatis dihitung dari due_at < sekarang. Gunakan saat owner tanya "piutang siapa aja", "invoice belum bayar", "jatuh tempo".',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(20),
      status: InvoiceStatusSchema.optional(),
      contactId: z.number().int().positive().optional(),
    }),
    outputSchema: z.object({
      invoices: z.array(InvoiceSchema),
      totalOutstandingIdr: z.number().int(),
      totalOutstandingFormatted: z.string(),
    }),
    execute: async ({ limit, status, contactId }) => {
      const lim = limit ?? 20;
      const now = Date.now();
      const clauses: string[] = ['i.tenant_id = ?'];
      const args: (string | number)[] = [tenantId];
      if (status === 'paid') {
        clauses.push('i.paid_at IS NOT NULL');
      } else if (status === 'overdue') {
        clauses.push('i.paid_at IS NULL AND i.due_at IS NOT NULL AND i.due_at < ?');
        args.push(now);
      } else if (status === 'pending') {
        clauses.push('i.paid_at IS NULL AND (i.due_at IS NULL OR i.due_at >= ?)');
        args.push(now);
      } else {
        clauses.push('i.paid_at IS NULL');
      }
      if (contactId != null) {
        clauses.push('i.contact_id = ?');
        args.push(contactId);
      }
      args.push(lim);
      const sql = `SELECT i.id, i.contact_id, i.amount_idr, i.description, i.due_at, i.paid_at, i.created_at, c.name AS contact_name
         FROM invoices i LEFT JOIN contacts c ON c.id = i.contact_id AND c.tenant_id = i.tenant_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY COALESCE(i.due_at, i.created_at) ASC LIMIT ?`;
      const result = await db.execute({ sql, args });
      const invoices = result.rows.map((r) => {
        const amountIdr = Number(r.amount_idr);
        const dueAt = r.due_at == null ? null : Number(r.due_at);
        const paidAt = r.paid_at == null ? null : Number(r.paid_at);
        return {
          id: Number(r.id),
          contactId: r.contact_id == null ? null : Number(r.contact_id),
          contactName: r.contact_name == null ? null : String(r.contact_name),
          amountIdr,
          amountFormatted: formatIDR(amountIdr),
          description: r.description == null ? null : String(r.description),
          dueAt,
          paidAt,
          status: computeStatus(dueAt, paidAt, now),
          createdAt: Number(r.created_at),
        };
      });
      const totalOutstandingIdr = invoices
        .filter((i) => i.status !== 'paid')
        .reduce((sum, i) => sum + i.amountIdr, 0);
      return {
        invoices,
        totalOutstandingIdr,
        totalOutstandingFormatted: formatIDR(totalOutstandingIdr),
      };
    },
  });

  const markInvoicePaid = createTool({
    id: 'mark-invoice-paid',
    description:
      'Tandai invoice sudah dibayar. Sekaligus otomatis catat sebagai income di log transaksi kalau recordTransaction=true (default true). Gunakan saat owner bilang "invoice X sudah bayar", "Y udah lunas".',
    inputSchema: z.object({
      invoiceId: z.number().int().positive(),
      paidAt: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe('Waktu pembayaran ISO-8601 dengan offset. Default: sekarang.'),
      recordTransaction: z
        .boolean()
        .default(true)
        .describe('Auto-catat sebagai income. Set false kalau sudah dicatat terpisah.'),
    }),
    outputSchema: InvoiceSchema.extend({
      transactionId: z.number().int().nullable(),
    }),
    execute: async ({ invoiceId, paidAt, recordTransaction }) => {
      const paidMs = paidAt ? new Date(paidAt).getTime() : Date.now();
      const recordTx = recordTransaction ?? true;
      const invRes = await db.execute({
        sql: 'SELECT contact_id, amount_idr, description, due_at, paid_at, created_at FROM invoices WHERE tenant_id = ? AND id = ?',
        args: [tenantId, invoiceId],
      });
      const inv = invRes.rows[0];
      if (!inv) throw new Error(`Invoice id ${invoiceId} tidak ditemukan`);
      if (inv.paid_at != null) {
        throw new Error(`Invoice id ${invoiceId} sudah ditandai lunas sebelumnya`);
      }
      const amountIdr = Number(inv.amount_idr);
      await db.execute({
        sql: 'UPDATE invoices SET paid_at = ? WHERE tenant_id = ? AND id = ?',
        args: [paidMs, tenantId, invoiceId],
      });
      let transactionId: number | null = null;
      if (recordTx) {
        const description =
          inv.description == null
            ? `Invoice #${invoiceId}`
            : `Invoice #${invoiceId}: ${String(inv.description)}`;
        const txRes = await db.execute({
          sql: 'INSERT INTO transactions (tenant_id, kind, amount_idr, description, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
          args: [tenantId, 'income', amountIdr, description, paidMs, paidMs],
        });
        const txRow = txRes.rows[0];
        if (txRow) transactionId = Number(txRow.id);
      }
      let contactName: string | null = null;
      if (inv.contact_id != null) {
        const cRes = await db.execute({
          sql: 'SELECT name FROM contacts WHERE tenant_id = ? AND id = ?',
          args: [tenantId, Number(inv.contact_id)],
        });
        const c = cRes.rows[0];
        if (c) contactName = String(c.name);
      }
      return {
        id: invoiceId,
        contactId: inv.contact_id == null ? null : Number(inv.contact_id),
        contactName,
        amountIdr,
        amountFormatted: formatIDR(amountIdr),
        description: inv.description == null ? null : String(inv.description),
        dueAt: inv.due_at == null ? null : Number(inv.due_at),
        paidAt: paidMs,
        status: 'paid' as const,
        createdAt: Number(inv.created_at),
        transactionId,
      };
    },
  });

  return { createInvoice, listInvoices, markInvoicePaid };
}
