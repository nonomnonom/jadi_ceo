import { createClient, type Client } from '@libsql/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runReminderFire } from '../src/handlers/reminder-fire.ts';

const TENANT = 'test-tenant';

async function initSchema(db: Client) {
  await db.execute(
    `CREATE TABLE reminders (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       tenant_id TEXT NOT NULL,
       content TEXT NOT NULL,
       remind_at INTEGER NOT NULL,
       done INTEGER NOT NULL DEFAULT 0,
       created_at INTEGER NOT NULL
     )`,
  );
}

async function seed(db: Client, content: string, remindAt: number, done = false): Promise<number> {
  const res = await db.execute({
    sql: 'INSERT INTO reminders (tenant_id, content, remind_at, done, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
    args: [TENANT, content, remindAt, done ? 1 : 0, Date.now()],
  });
  return Number(res.rows[0]?.id);
}

let db: Client;

beforeEach(async () => {
  db = createClient({ url: ':memory:' });
  await initSchema(db);
});

describe('runReminderFire', () => {
  it('dispatches a due reminder and marks it done', async () => {
    const id = await seed(db, 'telepon supplier', Date.now() - 1000);
    const send = vi.fn().mockResolvedValue({ ok: true });

    const result = await runReminderFire(
      { db, botToken: 'tok', chatId: '123', send },
      { tenantId: TENANT, reminderId: id },
    );

    expect(result).toEqual({ status: 'dispatched', reminderId: id });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toBe('123');
    expect(send.mock.calls[0]?.[1]).toContain('telepon supplier');

    const check = await db.execute({ sql: 'SELECT done FROM reminders WHERE id = ?', args: [id] });
    expect(Number(check.rows[0]?.done)).toBe(1);
  });

  it('returns already-done for a reminder that is already marked', async () => {
    const id = await seed(db, 'old', Date.now(), true);
    const send = vi.fn();

    const result = await runReminderFire(
      { db, botToken: 'tok', chatId: '123', send },
      { tenantId: TENANT, reminderId: id },
    );

    expect(result).toEqual({ status: 'already-done', reminderId: id });
    expect(send).not.toHaveBeenCalled();
  });

  it('returns already-done when row does not exist', async () => {
    const send = vi.fn();
    const result = await runReminderFire(
      { db, botToken: 'tok', chatId: '123', send },
      { tenantId: TENANT, reminderId: 9999 },
    );
    expect(result).toEqual({ status: 'already-done', reminderId: 9999 });
    expect(send).not.toHaveBeenCalled();
  });

  it('throws on missing bot token (BullMQ retries)', async () => {
    const id = await seed(db, 'x', Date.now());
    await expect(
      runReminderFire(
        { db, botToken: null, chatId: '123', send: vi.fn() },
        { tenantId: TENANT, reminderId: id },
      ),
    ).rejects.toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('throws on missing chat id (BullMQ retries)', async () => {
    const id = await seed(db, 'x', Date.now());
    await expect(
      runReminderFire(
        { db, botToken: 'tok', chatId: null, send: vi.fn() },
        { tenantId: TENANT, reminderId: id },
      ),
    ).rejects.toThrow(/TELEGRAM_OWNER_CHAT_ID/);
  });

  it('throws and leaves row undone when send fails', async () => {
    const id = await seed(db, 'retry-me', Date.now());
    const send = vi.fn().mockResolvedValue({ ok: false, error: 'rate limited' });

    await expect(
      runReminderFire(
        { db, botToken: 'tok', chatId: '123', send },
        { tenantId: TENANT, reminderId: id },
      ),
    ).rejects.toThrow(/rate limited/);

    const check = await db.execute({ sql: 'SELECT done FROM reminders WHERE id = ?', args: [id] });
    expect(Number(check.rows[0]?.done)).toBe(0);
  });

  it('scopes by tenant — cross-tenant id treated as already-done', async () => {
    const id = await seed(db, 'milik-a', Date.now());
    const send = vi.fn();
    const result = await runReminderFire(
      { db, botToken: 'tok', chatId: '123', send },
      { tenantId: 'different-tenant', reminderId: id },
    );
    expect(result.status).toBe('already-done');
    expect(send).not.toHaveBeenCalled();
  });
});
