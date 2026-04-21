import type { Db } from '../db/client.js';

export type DueReminder = {
  id: number;
  content: string;
  remindAt: number;
};

export type TickResult = {
  checked: number;
  dispatched: number;
  skipped: Array<{ id: number; reason: string }>;
};

export type SendFn = (
  chatId: string,
  text: string,
) => Promise<{ ok: true } | { ok: false; error: string }>;

export type TickDeps = {
  db: Db;
  tenantId: string;
  now?: () => number;
  send: SendFn;
  botToken: string | null;
  chatId: string | null;
};

export async function findDueReminders(
  db: Db,
  tenantId: string,
  now: number,
  limit = 50,
): Promise<DueReminder[]> {
  const res = await db.execute({
    sql: 'SELECT id, content, remind_at FROM reminders WHERE tenant_id = ? AND done = 0 AND remind_at <= ? ORDER BY remind_at ASC LIMIT ?',
    args: [tenantId, now, limit],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    content: String(r.content),
    remindAt: Number(r.remind_at),
  }));
}

export async function markDispatched(db: Db, reminderId: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE reminders SET done = 1 WHERE id = ?',
    args: [reminderId],
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatReminderMessage(r: DueReminder, now = Date.now()): string {
  const scheduled = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(r.remindAt));
  const lateMinutes = Math.max(0, Math.round((now - r.remindAt) / 60_000));
  const lateTag = lateMinutes >= 2 ? ` (telat ${lateMinutes} menit)` : '';
  return `⏰ <b>Pengingat</b>\n\n${escapeHtml(r.content)}\n\n<i>Dijadwalkan ${scheduled} WIB${lateTag}</i>`;
}

/**
 * Check the DB once and dispatch any due reminders via the injected `send` function.
 * Idempotent: if send fails or the process crashes before markDispatched, the next
 * tick retries because done still = 0.
 */
export async function tickOnce(deps: TickDeps): Promise<TickResult> {
  const now = (deps.now ?? Date.now)();
  const due = await findDueReminders(deps.db, deps.tenantId, now);
  if (due.length === 0) {
    return { checked: 0, dispatched: 0, skipped: [] };
  }

  if (!deps.botToken || !deps.chatId) {
    // Credentials missing — keep reminders in the queue. They'll fire once the
    // owner finishes Settings onboarding and restarts the server.
    const reason = !deps.botToken ? 'no telegram bot token' : 'no owner chat id';
    return {
      checked: due.length,
      dispatched: 0,
      skipped: due.map((r) => ({ id: r.id, reason })),
    };
  }

  let dispatched = 0;
  const skipped: TickResult['skipped'] = [];
  for (const r of due) {
    const result = await deps.send(deps.chatId, formatReminderMessage(r, now));
    if (result.ok) {
      await markDispatched(deps.db, r.id);
      dispatched++;
    } else {
      skipped.push({ id: r.id, reason: result.error });
    }
  }
  return { checked: due.length, dispatched, skipped };
}

/**
 * Production sender: POST to Telegram's Bot API sendMessage.
 */
export function createTelegramSender(botToken: string): SendFn {
  return async (chatId, text) => {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const data = (await res.json()) as { ok: boolean; description?: string };
      if (!data.ok) return { ok: false, error: data.description ?? `HTTP ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'send failed' };
    }
  };
}

const TICK_INTERVAL_MS = 60_000;

/**
 * Start the background interval. Ticks once immediately (catches reminders missed
 * during downtime), then every TICK_INTERVAL_MS. Returns a stop function.
 */
export function startReminderExecutor(db: Db, tenantId: string): () => void {
  const run = async () => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? null;
    const chatId = process.env.TELEGRAM_OWNER_CHAT_ID ?? null;
    const send = botToken ? createTelegramSender(botToken) : null;
    const result = await tickOnce({
      db,
      tenantId,
      botToken,
      chatId,
      send: send ?? (async () => ({ ok: false, error: 'no sender available' })),
    });
    if (result.dispatched > 0 || result.skipped.length > 0) {
      console.info(
        `[reminder-tick] checked=${result.checked} dispatched=${result.dispatched} skipped=${result.skipped.length}`,
        result.skipped,
      );
    }
  };

  // Fire-and-forget initial tick.
  run().catch((err) => {
    console.error('[reminder-tick] initial failure:', err);
  });

  const id = setInterval(() => {
    run().catch((err) => {
      console.error('[reminder-tick] failure:', err);
    });
  }, TICK_INTERVAL_MS);

  return () => clearInterval(id);
}
