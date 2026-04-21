import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { createReminderTools } from '../../src/mastra/tools/reminders.js';
import {
  findDueReminders,
  formatReminderMessage,
  tickOnce,
  type SendFn,
} from '../../src/reminders/executor.js';
import { runTool } from '../run-tool.js';

const TENANT = 'test-tenant';
const NOW = new Date('2026-04-21T07:00:00+07:00').getTime();

async function seedReminder(
  db: Db,
  opts: { content: string; remindAt: number; tenantId?: string; done?: boolean },
): Promise<number> {
  const res = await db.execute({
    sql: 'INSERT INTO reminders (tenant_id, content, remind_at, done, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
    args: [opts.tenantId ?? TENANT, opts.content, opts.remindAt, opts.done ? 1 : 0, NOW - 1000],
  });
  return Number(res.rows[0]?.id);
}

let db: Db;

beforeEach(async () => {
  db = createDb(':memory:');
  await initSchema(db);
});

describe('findDueReminders', () => {
  it('returns reminders with remind_at <= now and done = 0, sorted ASC', async () => {
    await seedReminder(db, { content: 'later', remindAt: NOW + 60_000 });
    const a = await seedReminder(db, { content: 'due-a', remindAt: NOW - 60_000 });
    const b = await seedReminder(db, { content: 'due-b', remindAt: NOW - 30_000 });
    await seedReminder(db, { content: 'already-done', remindAt: NOW - 10_000, done: true });

    const due = await findDueReminders(db, TENANT, NOW);
    expect(due.map((r) => r.id)).toEqual([a, b]);
  });

  it('scopes by tenant', async () => {
    await seedReminder(db, { content: 'other', remindAt: NOW - 1000, tenantId: 'other-tenant' });
    const due = await findDueReminders(db, TENANT, NOW);
    expect(due).toHaveLength(0);
  });
});

describe('tickOnce', () => {
  it('dispatches due reminders and marks them done', async () => {
    await seedReminder(db, { content: 'telepon supplier', remindAt: NOW - 5000 });
    await seedReminder(db, { content: 'kirim invoice', remindAt: NOW - 1000 });

    const calls: Array<{ chatId: string; text: string }> = [];
    const send: SendFn = async (chatId, text) => {
      calls.push({ chatId, text });
      return { ok: true };
    };

    const result = await tickOnce({
      db,
      tenantId: TENANT,
      now: () => NOW,
      botToken: 'fake',
      chatId: '12345',
      send,
    });

    expect(result).toEqual({ checked: 2, dispatched: 2, skipped: [] });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.chatId).toBe('12345');
    expect(calls[0]?.text).toContain('telepon supplier');

    const stillDue = await findDueReminders(db, TENANT, NOW);
    expect(stillDue).toHaveLength(0);
  });

  it('leaves reminders un-dispatched if credentials missing', async () => {
    await seedReminder(db, { content: 'a', remindAt: NOW - 1000 });
    const send = vi.fn();

    const result = await tickOnce({
      db,
      tenantId: TENANT,
      now: () => NOW,
      botToken: null,
      chatId: null,
      send,
    });

    expect(result.dispatched).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toMatch(/bot token/);
    expect(send).not.toHaveBeenCalled();

    const stillDue = await findDueReminders(db, TENANT, NOW);
    expect(stillDue).toHaveLength(1);
  });

  it('keeps reminder in queue when send fails (idempotent retry)', async () => {
    await seedReminder(db, { content: 'a', remindAt: NOW - 1000 });
    const send: SendFn = async () => ({ ok: false, error: 'rate limited' });

    const result = await tickOnce({
      db,
      tenantId: TENANT,
      now: () => NOW,
      botToken: 'fake',
      chatId: '12345',
      send,
    });

    expect(result.dispatched).toBe(0);
    expect(result.skipped[0]?.reason).toBe('rate limited');

    const stillDue = await findDueReminders(db, TENANT, NOW);
    expect(stillDue).toHaveLength(1);
  });

  it('does nothing when nothing is due', async () => {
    await seedReminder(db, { content: 'future', remindAt: NOW + 60_000 });
    const send = vi.fn();
    const result = await tickOnce({
      db,
      tenantId: TENANT,
      now: () => NOW,
      botToken: 'fake',
      chatId: '12345',
      send,
    });
    expect(result.checked).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('integrates with set-reminder tool end-to-end', async () => {
    const tools = createReminderTools({ db, tenantId: TENANT });
    await runTool(tools.setReminder, {
      content: 'minum obat',
      remindAt: new Date(NOW - 30_000).toISOString().replace('Z', '+00:00'),
    });

    const calls: string[] = [];
    const result = await tickOnce({
      db,
      tenantId: TENANT,
      now: () => NOW,
      botToken: 'fake',
      chatId: '12345',
      send: async (_, text) => {
        calls.push(text);
        return { ok: true };
      },
    });

    expect(result.dispatched).toBe(1);
    expect(calls[0]).toContain('minum obat');
  });
});

describe('formatReminderMessage', () => {
  it('formats Jakarta time and appends late tag when overdue', () => {
    const remindAt = NOW - 10 * 60_000;
    const msg = formatReminderMessage({ id: 1, content: 'test', remindAt }, NOW);
    expect(msg).toContain('test');
    expect(msg).toMatch(/telat 10 menit/);
    expect(msg).toMatch(/WIB/);
  });

  it('escapes HTML in user content', () => {
    const msg = formatReminderMessage(
      { id: 1, content: 'harga <b>jahat</b> & murah', remindAt: NOW },
      NOW,
    );
    expect(msg).toContain('harga &lt;b&gt;jahat&lt;/b&gt; &amp; murah');
    expect(msg).not.toContain('<b>jahat</b>');
  });

  it('omits late tag when on-time (< 2 min late)', () => {
    const msg = formatReminderMessage({ id: 1, content: 'test', remindAt: NOW - 30_000 }, NOW);
    expect(msg).not.toMatch(/telat/);
  });
});
