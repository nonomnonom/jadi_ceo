import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { createNoteTools } from '../../src/mastra/tools/notes.js';
import { createReminderTools } from '../../src/mastra/tools/reminders.js';
import { createTransactionTools } from '../../src/mastra/tools/transactions.js';
import { runTool } from '../run-tool.js';

const TENANT = 'test-tenant';

let db: Db;
let txTools: ReturnType<typeof createTransactionTools>;
let noteTools: ReturnType<typeof createNoteTools>;
let reminderTools: ReturnType<typeof createReminderTools>;

beforeEach(async () => {
  db = createDb(':memory:');
  await initSchema(db);
  txTools = createTransactionTools({ db, tenantId: TENANT });
  noteTools = createNoteTools({ db, tenantId: TENANT });
  reminderTools = createReminderTools({ db, tenantId: TENANT });
});

describe('logTransaction', () => {
  it('records income and formats Rupiah', async () => {
    const result = await runTool(txTools.logTransaction, {
      kind: 'income',
      amountIdr: 1500000,
      description: 'jualan hari ini',
    });
    expect(result.kind).toBe('income');
    expect(result.amountIdr).toBe(1500000);
    expect(result.amountFormatted).toBe('Rp 1.500.000');
    expect(result.description).toBe('jualan hari ini');
  });

  it('records expense', async () => {
    const result = await runTool(txTools.logTransaction, {
      kind: 'expense',
      amountIdr: 75000,
    });
    expect(result.kind).toBe('expense');
    expect(result.amountFormatted).toBe('Rp 75.000');
    expect(result.description).toBeNull();
  });

  it('respects explicit occurredAt', async () => {
    const iso = '2026-04-20T10:00:00+07:00';
    const result = await runTool(txTools.logTransaction, {
      kind: 'income',
      amountIdr: 50000,
      occurredAt: iso,
    });
    expect(result.occurredAt).toBe(new Date(iso).getTime());
  });
});

describe('getDailySummary', () => {
  it('tallies today only and reports pending reminders', async () => {
    await runTool(txTools.logTransaction, { kind: 'income', amountIdr: 1000000 });
    await runTool(txTools.logTransaction, { kind: 'income', amountIdr: 500000 });
    await runTool(txTools.logTransaction, { kind: 'expense', amountIdr: 300000 });
    await runTool(noteTools.addNote, { content: 'catatan hari ini' });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await runTool(txTools.logTransaction, {
      kind: 'income',
      amountIdr: 99999999,
      occurredAt: yesterday.toISOString(),
    });

    await runTool(reminderTools.setReminder, {
      content: 'telepon supplier',
      remindAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    const summary = await runTool(txTools.getDailySummary, {});
    expect(summary.incomeIdr).toBe(1_500_000);
    expect(summary.expenseIdr).toBe(300_000);
    expect(summary.netIdr).toBe(1_200_000);
    expect(summary.incomeFormatted).toBe('Rp 1.500.000');
    expect(summary.expenseFormatted).toBe('Rp 300.000');
    expect(summary.netFormatted).toBe('Rp 1.200.000');
    expect(summary.noteCount).toBe(1);
    expect(summary.pendingReminderCount).toBe(1);
  });

  it('returns zeros when nothing happened today', async () => {
    const summary = await runTool(txTools.getDailySummary, {});
    expect(summary.incomeIdr).toBe(0);
    expect(summary.expenseIdr).toBe(0);
    expect(summary.netIdr).toBe(0);
    expect(summary.noteCount).toBe(0);
    expect(summary.pendingReminderCount).toBe(0);
  });
});
