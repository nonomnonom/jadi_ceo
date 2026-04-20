import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { createReminderTools } from '../../src/mastra/tools/reminders.js';
import { runTool } from '../run-tool.js';

const TENANT = 'test-tenant';

let db: Db;
let tools: ReturnType<typeof createReminderTools>;

beforeEach(async () => {
  db = createDb(':memory:');
  await initSchema(db);
  tools = createReminderTools({ db, tenantId: TENANT });
});

describe('setReminder', () => {
  it('stores a reminder with ISO datetime and returns unified shape', async () => {
    const remindAt = '2026-05-01T09:00:00+07:00';
    const result = await runTool(tools.setReminder, {
      content: 'telepon supplier',
      remindAt,
    });
    expect(result.id).toBeGreaterThan(0);
    expect(result.content).toBe('telepon supplier');
    expect(result.remindAt).toBe(new Date(remindAt).getTime());
    expect(result.done).toBe(false);
  });
});

describe('listReminders', () => {
  it('returns only pending reminders, soonest first', async () => {
    await runTool(tools.setReminder, {
      content: 'nanti',
      remindAt: '2026-06-01T09:00:00+07:00',
    });
    await runTool(tools.setReminder, {
      content: 'lebih cepat',
      remindAt: '2026-05-01T09:00:00+07:00',
    });
    const { reminders } = await runTool(tools.listReminders, { limit: 10 });
    expect(reminders).toHaveLength(2);
    expect(reminders[0]?.content).toBe('lebih cepat');
    expect(reminders[1]?.content).toBe('nanti');
  });

  it('excludes reminders marked done', async () => {
    const { id } = await runTool(tools.setReminder, {
      content: 'sudah beres',
      remindAt: '2026-05-01T09:00:00+07:00',
    });
    await db.execute({ sql: 'UPDATE reminders SET done = 1 WHERE id = ?', args: [id] });
    const { reminders } = await runTool(tools.listReminders, { limit: 10 });
    expect(reminders).toHaveLength(0);
  });

  it('scopes by tenant', async () => {
    await runTool(tools.setReminder, {
      content: 'milik A',
      remindAt: '2026-05-01T09:00:00+07:00',
    });
    const other = createReminderTools({ db, tenantId: 'tenant-B' });
    const { reminders } = await runTool(other.listReminders, { limit: 10 });
    expect(reminders).toHaveLength(0);
  });
});
