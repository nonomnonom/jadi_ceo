import type { ReminderFireJob } from '@juragan/queue';
import type { Job } from 'bullmq';
import type { Db } from '../db.ts';
import { type SendResult, formatReminderMessage, sendTelegramMessage } from '../telegram.ts';

export type HandlerDeps = {
  db: Db;
  botToken: string | null;
  chatId: string | null;
  send?: (chatId: string, text: string) => Promise<SendResult>;
};

export type HandlerOutcome =
  | { status: 'dispatched'; reminderId: number }
  | { status: 'already-done'; reminderId: number }
  | { status: 'missing-credentials'; reminderId: number }
  | { status: 'send-failed'; reminderId: number; error: string };

/**
 * Pure handler (no BullMQ coupling) so it's testable with a stubbed db + sender.
 * The BullMQ Worker calls `runReminderFire(deps, job.data)`.
 *
 * Idempotency:
 *  - Re-reads the row with `done = 0` filter. If another process already fired
 *    this reminder (setInterval fallback race), returns 'already-done' silently.
 *  - UPDATE is conditional on `done = 0` to avoid double-marking.
 *
 * Retry contract:
 *  - `missing-credentials` throws (BullMQ retries with exponential backoff).
 *  - `send-failed` throws (BullMQ retries).
 *  - `dispatched` / `already-done` resolve cleanly.
 */
export async function runReminderFire(
  deps: HandlerDeps,
  data: ReminderFireJob,
): Promise<HandlerOutcome> {
  const { tenantId, reminderId } = data;

  const row = await deps.db.execute({
    sql: 'SELECT content, remind_at FROM reminders WHERE id = ? AND tenant_id = ? AND done = 0',
    args: [reminderId, tenantId],
  });
  const reminder = row.rows[0];
  if (!reminder) {
    return { status: 'already-done', reminderId };
  }

  if (!deps.botToken || !deps.chatId) {
    // Throw so BullMQ retries later, assuming credentials arrive soon.
    throw new Error(
      `missing credentials: ${!deps.botToken ? 'TELEGRAM_BOT_TOKEN' : 'TELEGRAM_OWNER_CHAT_ID'}`,
    );
  }

  const text = formatReminderMessage({
    content: String(reminder.content),
    remindAt: Number(reminder.remind_at),
  });

  const send = deps.send ?? ((id, t) => sendTelegramMessage(deps.botToken as string, id, t));
  const result = await send(deps.chatId, text);

  if (!result.ok) {
    throw new Error(`send failed: ${result.error}`);
  }

  await deps.db.execute({
    sql: 'UPDATE reminders SET done = 1 WHERE id = ? AND tenant_id = ? AND done = 0',
    args: [reminderId, tenantId],
  });

  return { status: 'dispatched', reminderId };
}

export async function reminderFireProcessor(job: Job<ReminderFireJob>): Promise<HandlerOutcome> {
  // Lazy imports keep this file pure-importable for tests.
  const { getDb } = await import('../db.ts');
  return runReminderFire(
    {
      db: getDb(),
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? null,
      chatId: process.env.TELEGRAM_OWNER_CHAT_ID ?? null,
    },
    job.data,
  );
}
