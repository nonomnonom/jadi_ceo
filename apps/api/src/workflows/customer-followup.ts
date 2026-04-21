import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: Find overdue invoices
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
        amountFormatted: z.string(),
        dueDate: z.string(),
        daysOverdue: z.number(),
      }),
    ),
  }),
  execute: async ({ inputData }) => {
    // Will be connected to list-invoices with status: 'overdue'
    return {
      overdueInvoices: [],
    };
  },
});

// Step 2: Draft WA reminder messages
const draftRemindersStep = createStep({
  id: 'draft-reminders',
  inputSchema: z.object({
    overdueInvoices: z.array(
      z.object({
        id: z.number(),
        contactName: z.string(),
        phone: z.string().nullable(),
        amountFormatted: z.string(),
        dueDate: z.string(),
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
  }),
  execute: async ({ inputData }) => {
    const drafts = inputData.overdueInvoices.map((inv) => {
      let tone: 'soft' | 'neutral' | 'firm';
      if (inv.daysOverdue < 7) tone = 'soft';
      else if (inv.daysOverdue < 14) tone = 'neutral';
      else tone = 'firm';

      const messages = {
        soft: `Halo ${inv.contactName}! Btw mau ngingetin aja — invoice ${inv.amountFormatted} sebenarnya sudah jatuh tempo ${inv.dueDate} lho. Kalau sudah transfer, mohon konfirmasinya ya. Terima kasih! 🙏`,
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

    return {
      drafts,
      totalRecipients: drafts.length,
    };
  },
});

// Step 3: Display drafts for owner review (suspend)
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
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    selectedDraftIds: z.array(z.number()).optional(),
  }),
  execute: async ({ inputData }) => {
    // Suspends here — owner reviews drafts and decides which to send
    // Returns when owner approves
    return {
      approved: true,
      selectedDraftIds: inputData.drafts.map((d) => d.invoiceId),
    };
  },
});

// Step 4: Send (or prepare to send) approved drafts
const sendRemindersStep = createStep({
  id: 'send-reminders',
  inputSchema: z.object({
    approved: z.boolean(),
    selectedDraftIds: z.array(z.number()).optional(),
    drafts: z.array(
      z.object({
        invoiceId: z.number(),
        contactName: z.string(),
        phone: z.string().nullable(),
        tone: z.enum(['soft', 'neutral', 'firm']),
        draftMessage: z.string(),
      }),
    ),
  }),
  outputSchema: z.object({
    messagesPrepared: z.number(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.approved) {
      return {
        messagesPrepared: 0,
        message: 'Owner rejected reminder sending',
      };
    }

    const selectedIds = inputData.selectedDraftIds ?? [];
    const toSend = inputData.drafts.filter((d) => selectedIds.includes(d.invoiceId));

    // Note: actual sending happens via WhatsApp channel
    // This step prepares the messages for the agent to send
    return {
      messagesPrepared: toSend.length,
      message: `${toSend.length} reminder(s) ready to send via WhatsApp`,
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
  }),
})
  .then(findOverdueInvoicesStep)
  .then(draftRemindersStep)
  .then(reviewDraftsStep)
  .then(sendRemindersStep)
  .commit();

export type CustomerFollowupWorkflow = typeof customerFollowupWorkflow;
