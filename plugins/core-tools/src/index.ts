/**
 * Core Business Tools Plugin
 *
 * Registers the foundational CRUD tools as a plugin:
 * notes, transactions, products, contacts, invoices, reminders, scheduled-prompts.
 *
 * Each tool factory is called at registration time with the singleton db
 * and default tenant ID, matching the pattern used in owner-supervisor.ts.
 */

import { definePluginEntry } from '@juragan/plugin-sdk';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { getDb } from '../../apps/api/src/db/client.js';
import { createNoteTools } from '../../apps/api/src/mastra/tools/notes.js';
import { createTransactionTools } from '../../apps/api/src/mastra/tools/transactions.js';
import { createProductTools } from '../../apps/api/src/mastra/tools/products.js';
import { createContactTools } from '../../apps/api/src/mastra/tools/contacts.js';
import { createInvoiceTools } from '../../apps/api/src/mastra/tools/invoices.js';
import { createReminderTools } from '../../apps/api/src/mastra/tools/reminders.js';
import { createScheduledPromptTools } from '../../apps/api/src/mastra/tools/scheduled-prompts.js';

export default definePluginEntry(
  {
    id: 'core-tools',
    name: 'Core Business Tools',
    version: '1.0.0',
    description:
      'Core CRUD tools: notes, transactions, products, contacts, invoices, reminders, scheduling',
  },
  (api) => {
    const db = getDb();
    const tenantId = DEFAULT_TENANT_ID;

    const { addNote, listNotes } = createNoteTools({ db, tenantId });
    const { logTransaction, getDailySummary } = createTransactionTools({ db, tenantId });
    const { addProduct, listProducts, adjustStock } = createProductTools({ db, tenantId });
    const { addContact, listContacts } = createContactTools({ db, tenantId });
    const { createInvoice, listInvoices, markInvoicePaid } = createInvoiceTools({ db, tenantId });
    const { setReminder, listReminders } = createReminderTools({ db, tenantId });
    const { schedulePrompt, listScheduledPrompts, cancelScheduledPrompt } =
      createScheduledPromptTools({ db, tenantId });

    // Notes
    api.registerTool(addNote);
    api.registerTool(listNotes);

    // Transactions
    api.registerTool(logTransaction);
    api.registerTool(getDailySummary);

    // Products
    api.registerTool(addProduct);
    api.registerTool(listProducts);
    api.registerTool(adjustStock);

    // Contacts
    api.registerTool(addContact);
    api.registerTool(listContacts);

    // Invoices
    api.registerTool(createInvoice);
    api.registerTool(listInvoices);
    api.registerTool(markInvoicePaid);

    // Reminders
    api.registerTool(setReminder);
    api.registerTool(listReminders);

    // Scheduled prompts
    api.registerTool(schedulePrompt);
    api.registerTool(listScheduledPrompts);
    api.registerTool(cancelScheduledPrompt);
  },
);
