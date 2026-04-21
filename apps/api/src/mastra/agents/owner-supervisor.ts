import { createTelegramAdapter } from '@chat-adapter/telegram';
import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { getDb } from '../../db/client.js';
import { createContactTools } from '../tools/contacts.js';
import { createInvoiceTools } from '../tools/invoices.js';
import { createNoteTools } from '../tools/notes.js';
import { createProductTools } from '../tools/products.js';
import { createReminderTools } from '../tools/reminders.js';
import { createScheduledPromptTools } from '../tools/scheduled-prompts.js';
import { getCurrentTime } from '../tools/time.js';
import { createTransactionTools } from '../tools/transactions.js';
import { createOwnerWorkspace } from '../workspace.js';
import { catalogAgent } from './catalog-agent.js';
import { contactAgent } from './contact-agent.js';
import { financeAgent } from './finance-agent.js';
import { invoiceAgent } from './invoice-agent.js';
import { noteAgent } from './note-agent.js';

const db = getDb();

const { addNote, listNotes } = createNoteTools({ db, tenantId });
const { logTransaction, getDailySummary } = createTransactionTools({ db, tenantId });
const { setReminder, listReminders } = createReminderTools({ db, tenantId });
const { schedulePrompt, listScheduledPrompts, cancelScheduledPrompt } = createScheduledPromptTools({
  db,
  tenantId,
});
const { addProduct, listProducts, adjustStock } = createProductTools({ db, tenantId });
const { addContact, listContacts } = createContactTools({ db, tenantId });
const { createInvoice, listInvoices, markInvoicePaid } = createInvoiceTools({ db, tenantId });

export const ownerWorkspace = createOwnerWorkspace(tenantId);

const supervisorInstructions = `
Kamu adalah **Juragan** — asisten pribadi untuk owner bisnis Indonesia.
Untuk tugas spesifik, delegasi ke agent domain:

- **noteAgent** — catatan dan ide. Delegasi untuk add-note (simpan catatan baru) dan list-notes (lihat catatan).
- **financeAgent** — pembukuan Income/expense dan ringkasan harian. Delegasi untuk log-transaction dan get-daily-summary.
- **catalogAgent** — produk, harga, dan stok. Delegasi untuk add-product, list-products, adjust-stock.
- **contactAgent** — kontak customer dan supplier. Delegasi untuk add-contact dan list-contacts.
- **invoiceAgent** — invoice dan piutang. Delegasi untuk create-invoice, list-invoices, mark-invoice-paid.

Untuk tugas yang bukan domain spesifik di atas, handle sendiri dengan tool yang tersedia:
- get-current-time — selalu pertama kalau butuh waktu
- Workspace tools: list_files, read_file, grep, write_file
- Skills: skill, skill_read, skill_search
- Reminders: set-reminder, list-reminders
- Scheduling: schedule-prompt, list-scheduled-prompts, cancel-scheduled-prompt

## Gaya bicara
Bahasa Indonesia casual tapi sopan (gunakan "kamu"/"owner"), singkat, langsung ke poin.
`.trim();

export const ownerSupervisor = new Agent({
  id: 'owner-supervisor',
  name: 'Owner Supervisor',
  description:
    'Asisten pribadi bahasa Indonesia untuk owner bisnis: memutuskan apakah harus delegasi ke sub-agent domain atau handle sendiri.',
  instructions: supervisorInstructions,
  model: 'openrouter/anthropic/claude-sonnet-4-6',
  agents: {
    noteAgent,
    financeAgent,
    catalogAgent,
    contactAgent,
    invoiceAgent,
  },
  tools: {
    addNote,
    listNotes,
    logTransaction,
    getDailySummary,
    setReminder,
    listReminders,
    schedulePrompt,
    listScheduledPrompts,
    cancelScheduledPrompt,
    getCurrentTime,
    addProduct,
    listProducts,
    adjustStock,
    addContact,
    listContacts,
    createInvoice,
    listInvoices,
    markInvoicePaid,
  },
  workspace: ownerWorkspace,
  memory: new Memory({
    options: {
      lastMessages: 20,
    },
  }),
  ...(process.env.TELEGRAM_BOT_TOKEN
    ? {
        channels: {
          adapters: {
            telegram: createTelegramAdapter({
              mode: 'auto' as const,
              longPolling: {
                dropPendingUpdates: true,
              },
            }),
          },
        },
      }
    : {}),
});
