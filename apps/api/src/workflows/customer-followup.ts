import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import { formatIDR } from '@juragan/shared';

// Step 1: Find overdue invoices from DB
const findOverdueInvoicesStep = createStep({
  id: 'find-overdue-invoices',
  inputSchema: z.object({
    tenantId: z.string(),
  }),
  outputSchema: z.object({
    overdueInvoices: z.array(
      z.object({
        id: z.number(),
        contactName: z.string(),
        phone: z.string().nullable(),
        amountIdr: z.number(),
        amountFormatted: z.string(),
        dueDate: z.string(),
        dueTimestamp: z.number(),
        daysOverdue: z.number(),
      }),
    ),
    totalOverdue: z.number(),
    totalAmount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const db = getDb();
    const { tenantId } = inputData;
    const now = Date.now();

    const result = await db.execute({
      sql: `SELECT i.id, i.contact_id, i.amount_idr, i.due_at,
                    c.name as contact_name, c.phone
             FROM invoices i
             LEFT JOIN contacts c ON i.contact_id = c.id
             WHERE i.tenant_id = ?
               AND i.paid_at IS NULL
               AND i.due_at IS NOT NULL
               AND i.due_at < ?
             ORDER BY i.due_at ASC`,
      args: [tenantId, now],
    });

    const overdueInvoices = result.rows.map((r) => {
      const dueTimestamp = Number(r.due_at);
      const dueDate = new Date(dueTimestamp);
      const daysOverdue = Math.floor((now - dueTimestamp) / (1000 * 60 * 60 * 24));

      return {
        id: Number(r.id),
        contactName: r.contact_name ? String(r.contact_name) : 'Unknown',
        phone: r.phone ? String(r.phone) : null,
        amountIdr: Number(r.amount_idr),
        amountFormatted: formatIDR(Number(r.amount_idr)),
        dueDate: dueDate.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        dueTimestamp,
        daysOverdue,
      };
    });

    const totalAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amountIdr, 0);

    return {
      overdueInvoices,
      totalOverdue: overdueInvoices.length,
      totalAmount,
    };
  },
});

// Step 2: Draft WA reminder messages with tone based on days overdue
const draftRemindersStep = createStep({
  id: 'draft-reminders',
  inputSchema: z.object({
    overdueInvoices: z.array(
      z.object({
        id: z.number(),
        contactName: z.string(),
        phone: z.string().nullable(),
        amountIdr: z.number(),
        amountFormatted: z.string(),
        dueDate: z.string(),
        dueTimestamp: z.number(),
        daysOverdue: z.number(),
      }),
    ),
  }),
  outputSchema: z.object({
    drafts: z.array(
      z.object({
        invoiceId: z.number(),
        contactName: z.string(),
        phone: z.string().nullable(),
        tone: z.enum(['soft', 'neutral', 'firm']),
        draftMessage: z.string(),
      }),
    ),
    totalRecipients: z.number(),
    totalAmountFormatted: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { overdueInvoices } = inputData;

    const drafts = overdueInvoices.map((inv) => {
      let tone: 'soft' | 'neutral' | 'firm';
      if (inv.daysOverdue < 7) tone = 'soft';
      else if (inv.daysOverdue < 14) tone = 'neutral';
      else tone = 'firm';

      const messages = {
        soft: `Halo ${inv.contactName}! Btw mau ngingetin aja — invoice ${inv.amountFormatted} sebenarnya sudah jatuh tempo ${inv.dueDate} nih. Kalau sudah transfer, mohon konfirmasinya ya. Terima kasih! 🙏`,
        neutral: `Halo ${inv.contactName}, invoice ${inv.amountFormatted} sudah lewat jatuh tempo ${inv.daysOverdue} hari dari ${inv.dueDate}. Mohon konfirmasi kapan bisa dilunasi ya. Terima kasih.`,
        firm: `Halo ${inv.contactName}, invoice ${inv.amountFormatted} sudah lewat ${inv.daysOverdue} hari dari jatuh tempo ${inv.dueDate}. Mohon diselesaikan dalam 3 hari kerja. Kalau ada kendala, hubungi saya secepatnya. Terima kasih.`,
      };

      return {
        invoiceId: inv.id,
        contactName: inv.contactName,
        phone: inv.phone,
        tone,
        draftMessage: messages[tone],
      };
    });

    const totalAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amountIdr, 0);

    return {
      drafts,
      totalRecipients: drafts.length,
      totalAmountFormatted: formatIDR(totalAmount),
    };
  },
});

// Step 3: Suspend for owner review and selection
const reviewDraftsStep = createStep({
  id: 'review-drafts',
  inputSchema: z.object({
    drafts: z.array(
      z.object({
        invoiceId: z.number(),
        contactName: z.string(),
        phone: z.string().nullable(),
        tone: z.enum(['soft', 'neutral', 'firm']),
        draftMessage: z.string(),
      }),
    ),
    totalRecipients: z.number(),
    totalAmountFormatted: z.string(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    selectedDraftIds: z.array(z.number()),
    selectedMessages: z.array(
      z.object({
        invoiceId: z.number(),
        contactName: z.string(),
        phone: z.string().nullable(),
        draftMessage: z.string(),
      }),
    ),
  }),
  resumeSchema: z.object({
    action: z.enum(['approve', 'reject']),
    selectedInvoiceIds: z.array(z.number()).optional(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { drafts, totalRecipients, totalAmountFormatted } = inputData;

    if (resumeData) {
      const { action, selectedInvoiceIds } = resumeData;

      if (action === 'reject') {
        return {
          approved: false,
          selectedDraftIds: [],
          selectedMessages: [],
        };
      }

      const selectedIds = selectedInvoiceIds ?? drafts.map((d) => d.invoiceId);
      const selectedMessages = drafts
        .filter((d) => selectedIds.includes(d.invoiceId))
        .map((d) => ({
          invoiceId: d.invoiceId,
          contactName: d.contactName,
          phone: d.phone,
          draftMessage: d.draftMessage,
        }));

      return {
        approved: true,
        selectedDraftIds: selectedIds,
        selectedMessages,
      };
    }

    // First run - suspend for owner review
    const summary = `${totalRecipients} invoice overdue, total Rp ${totalAmountFormatted}`;

    return suspend({
      reason: `Invoice reminder siap: ${summary}. Ketik /followup approve untuk kirim semua, atau /followup approve [id1,id2] untuk pilih tertentu. /followup reject untuk batal.`,
      drafts,
      totalRecipients,
      totalAmountFormatted,
    });
  },
});

// Step 4: Prepare reminder messages for sending
const prepareRemindersStep = createStep({
  id: 'prepare-reminders',
  inputSchema: z.object({
    approved: z.boolean(),
    selectedMessages: z.array(
      z.object({
        invoiceId: z.number(),
        contactName: z.string(),
        phone: z.string().nullable(),
        draftMessage: z.string(),
      }),
    ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messagesPrepared: z.number(),
    readyToSend: z.array(
      z.object({
        invoiceId: z.number(),
        phone: z.string(),
        message: z.string(),
      }),
    ),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { approved, selectedMessages } = inputData;

    if (!approved || selectedMessages.length === 0) {
      return {
        success: false,
        messagesPrepared: 0,
        readyToSend: [],
        message: 'Tidak ada reminder yang akan dikirim',
      };
    }

    // Filter out messages without phone numbers
    const readyToSend = selectedMessages
      .filter((m) => m.phone)
      .map((m) => ({
        invoiceId: m.invoiceId,
        phone: m.phone!,
        message: m.draftMessage,
      }));

    return {
      success: true,
      messagesPrepared: readyToSend.length,
      readyToSend,
      message: `${readyToSend.length} reminder(s) siap dikirim via WhatsApp`,
    };
  },
});

export const customerFollowupWorkflow = createWorkflow({
  id: 'customer-followup',
  inputSchema: z.object({
    tenantId: z.string(),
    overdueOnly: z.boolean().default(true),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messagesPrepared: z.number(),
    message: z.string(),
  }),
})
  .then(findOverdueInvoicesStep)
  .then(draftRemindersStep)
  .then(reviewDraftsStep)
  .then(prepareRemindersStep)
  .commit();

export type CustomerFollowupWorkflow = typeof customerFollowupWorkflow;
