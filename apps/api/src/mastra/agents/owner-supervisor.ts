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

// Command tools
import { createOrderCommandTools } from '../tools/owner/order-commands.js';
import { createCustomerCommandTools } from '../tools/owner/customer-commands.js';
import { createAgentCtlTools } from '../tools/owner/agent-ctl-commands.js';
import { createModelCommandTools } from '../tools/owner/model-commands.js';
import { createMemoryCommandTools } from '../tools/owner/memory-commands.js';
import { createSkillCommandTools } from '../tools/owner/skill-commands.js';
import { createOwnerPaymentTools } from '../tools/owner/payment-tools.js';
import { createCashflowReportTools } from '../tools/owner/cashflow-report.js';
import { createExpenseCategoryTools } from '../tools/owner/expense-category.js';
import { createSearchContactsTools } from '../tools/owner/search-contacts.js';
import { createStockMovementTools } from '../tools/owner/stock-movements.js';
import { createRetryCommandTools } from '../tools/owner/retry-commands.js';
import { createThreadCommandTools } from '../tools/owner/thread-commands.js';

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

// Owner command tools
const { listOrders, approveOrder, rejectOrder } = createOrderCommandTools({ db, tenantId });
const {
  listCustomerOrders,
  viewCustomerConversation,
  getCustomerAnalytics,
  customerOverride,
} = createCustomerCommandTools({
  db,
  tenantId,
});
const {
  getCustomerAgentStatus,
  enableCustomerAgent,
  disableCustomerAgent,
  listRecentConversations,
  listAcpSessions,
  spawnSubAgent,
} = createAgentCtlTools({ db, tenantId });
const { getCurrentModel, switchModel, listSupportedModels } = createModelCommandTools({
  db,
  tenantId,
});
const { searchMemory, readMemory, getMemoryStats } = createMemoryCommandTools({ db, tenantId });
const { listSkills, triggerSkill } = createSkillCommandTools({ db, tenantId });
const { generatePaymentLink, cancelPayment, simulatePayment } = createOwnerPaymentTools({
  db,
  tenantId,
});
const { getCashflowReport } = createCashflowReportTools({ db, tenantId });
const { listExpenseCategories, addExpenseCategory, deleteExpenseCategory } = createExpenseCategoryTools({
  db,
  tenantId,
});
const { searchContacts, getContactDetail } = createSearchContactsTools({ db, tenantId });
const { listStockMovements, getProductStockSummary } = createStockMovementTools({ db, tenantId });
const { getRetryStatus, retryLastAction, clearRetry } = createRetryCommandTools({ db, tenantId });
const { setThread, getThread, clearThread } = createThreadCommandTools({ db, tenantId });

export const ownerWorkspace = createOwnerWorkspace(tenantId);

const supervisorInstructions = `
Kamu adalah **Juragan** — asisten pribadi untuk owner bisnis Indonesia.

## Perintah Slash (Slash Commands)
Gunakan tool yang sesuai saat owner mengetik perintah:

### /order - Kelola Pesanan
- "/order list" → panggil list-orders
- "/order approve [id]" → panggil approve-order
- "/order reject [id]" → panggil reject-order

### /customer - Data Customer WhatsApp
- "/customer orders" → panggil list-customer-orders
- "/customer view [phone]" → panggil view-customer-conversation
- "/customer analytics" → panggil get-customer-analytics
- "/customer override [id] [approve|reject|cancel|mark-paid]" → panggil customer-override

### /customer-agent - Kontrol Customer Agent
- "/customer-agent status" → panggil get-customer-agent-status
- "/customer-agent enable" → panggil enable-customer-agent
- "/customer-agent disable" → panggil disable-customer-agent
- "/customer-agent view-all" → panggil list-recent-conversations
- "/customer-agent sessions" → panggil list-acp-sessions

### /spawn - Spawn Sub-Agent
- "/spawn [task]" → panggil spawn-sub-agent untuk jalankan task di background

### /model - Model AI
- "/model" (tanpa argumen) → panggil get-current-model
- "/model [provider/model]" → panggil switch-model
- "/model list" → panggil list-supported-models

### /memory - Memory
- "/memory search [query]" → panggil memory-search
- "/memory read [id]" → panggil memory-read
- "/memory stats" → panggil memory-stats

### /skill - Skills
- "/skill" (tanpa argumen) → panggil list-skills
- "/skill [nama]" → panggil trigger-skill

### /payment - Payment (Owner)
- "/payment link [orderId] [amount]" → panggil generate-payment-link
- "/payment cancel [orderId]" → panggil cancel-payment
- "/payment simulate [orderId]" → panggil simulate-payment (sandbox only)

### /cashflow - Laporan Arus Kas
- "/cashflow" atau "/cashflow [hari]" → panggil get-cashflow-report (default 7 hari)

### /contact - Kontak
- "/contact search [query]" → panggil search-contacts
- "/contact [id]" → panggil get-contact-detail

### /stock - Stok
- "/stock movements [productId]" → panggil list-stock-movements
- "/stock summary" → panggil get-product-stock-summary

### /category - Kategori Pengeluaran
- "/category list" → panggil list-expense-categories
- "/category add [nama]" → panggil add-expense-category

### /retry - Retry Action Gagal
- "/retry" → panggil retry-last-action untuk mengulang action terakhir yang gagal
- "/retry status" → panggil get-retry-status untuk melihat apakah ada action yang bisa di-retry

### /thread - Topik Percakapan
- "/thread [topik]" → panggil set-thread untuk set topik aktif
- "/thread" (tanpa argumen) → panggil get-thread untuk lihat topik aktif
- "/thread clear" → panggil clear-thread untuk reset topik

## Delegasi ke Sub-Agent
Untuk tugas spesifik, delegasi ke agent domain:

- **noteAgent** — catatan dan ide. Delegasi untuk add-note (simpan catatan baru) dan list-notes (lihat catatan).
- **financeAgent** — pembukuan Income/expense dan ringkasan harian. Delegasi untuk log-transaction dan get-daily-summary.
- **catalogAgent** — produk, harga, dan stok. Delegasi untuk add-product, list-products, adjust-stock.
- **contactAgent** — kontak customer dan supplier. Delegasi untuk add-contact dan list-contacts.
- **invoiceAgent** — invoice dan piutang. Delegasi untuk create-invoice, list-invoices, mark-invoice-paid.

## Tool Umum
- get-current-time — selalu pertama kalau butuh waktu
- Workspace tools: list_files, read_file, grep, write_file
- Skills: list-skills, trigger-skill
- Reminders: set-reminder, list-reminders
- Scheduling: schedule-prompt, list-scheduled-prompts, cancel-scheduled-prompt

## Gaya bicara
Bahasa Indonesia casual tapi sopan (gunakan "kamu"/"owner"), singkat, langsung ke poin.

## Invalid Command Handling
Jika owner mengirim perintah slash yang tidak kamu kenal (misal: "/xyz", "/foo bar"), JANGAN pura-pura menangani. Respons dengan:
"Perintah tidak dikenal. Perintah yang tersedia: /order, /customer, /customer-agent, /model, /memory, /skill, /payment, /cashflow, /contact, /stock, /category, /retry, /spawn. Ketik /skill untuk lihat skill lainnya."
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
    // Basic CRUD
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
    // Order commands
    listOrders,
    approveOrder,
    rejectOrder,
    // Customer commands
    listCustomerOrders,
    viewCustomerConversation,
    getCustomerAnalytics,
    customerOverride,
    // Agent control
    getCustomerAgentStatus,
    enableCustomerAgent,
    disableCustomerAgent,
    listRecentConversations,
    listAcpSessions,
    spawnSubAgent,
    // Model commands
    getCurrentModel,
    switchModel,
    listSupportedModels,
    // Memory commands
    searchMemory,
    readMemory,
    getMemoryStats,
    // Skill commands
    listSkills,
    triggerSkill,
    // Payment commands
    generatePaymentLink,
    cancelPayment,
    simulatePayment,
    // Cashflow & Reports
    getCashflowReport,
    listExpenseCategories,
    addExpenseCategory,
    deleteExpenseCategory,
    // Contact management
    searchContacts,
    getContactDetail,
    // Stock management
    listStockMovements,
    getProductStockSummary,
    // Retry commands
    getRetryStatus,
    retryLastAction,
    clearRetry,
    // Thread context
    setThread,
    getThread,
    clearThread,
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
