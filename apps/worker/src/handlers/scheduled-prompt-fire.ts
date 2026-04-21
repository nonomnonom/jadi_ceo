import {
  QUEUE_NAMES,
  type ScheduledPromptFireJob,
  getScheduledPromptQueue,
  scheduledPromptJobId,
} from '@juragan/queue';
import type { Job } from 'bullmq';

/**
 * Worker handler for scheduled-prompt-fire jobs.
 *
 * 1. Re-read the DB row — skip if inactive or missing (idempotent)
 * 2. Execute the prompt via HTTP call to the API server (which runs the agent)
 * 3. Send result to Telegram
 * 4. Compute next fire time, update row, re-schedule if still active
 */

type FireResult =
  | { status: 'fired'; responseText: string }
  | { status: 'skipped' }
  | { status: 'error'; error: string };

export async function runScheduledPromptFire(
  deps: { db: import('../db.ts').Db; botToken: string | null; chatId: string | null },
  data: ScheduledPromptFireJob,
): Promise<FireResult> {
  const { tenantId, scheduledPromptId } = data;

  const row = await deps.db.execute({
    sql: `SELECT id, prompt, cron_expr, interval_sec, active
          FROM scheduled_prompts WHERE id = ? AND tenant_id = ? AND active = 1`,
    args: [scheduledPromptId, tenantId],
  });
  const sched = row.rows[0];
  if (!sched) {
    return { status: 'skipped' };
  }

  const intervalSec = Number(sched.interval_sec);

  // Execute via HTTP call to the API server (which runs the agent)
  let responseText: string;
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4111';
  try {
    const res = await fetch(`${apiBase}/custom/execute-scheduled-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.DASHBOARD_SECRET
          ? { Authorization: `Bearer ${process.env.DASHBOARD_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ scheduledPromptId }),
      signal: AbortSignal.timeout(120_000),
    });
    const json = (await res.json()) as { response?: string; error?: string };
    if (!res.ok) {
      return { status: 'error', error: json.error ?? `API ${res.status}` };
    }
    responseText =
      typeof json.response === 'string' ? json.response : JSON.stringify(json.response);
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'fetch failed' };
  }

  // Send result to Telegram
  if (deps.botToken && deps.chatId) {
    const { sendTelegramMessage } = await import('../telegram.js');
    await sendTelegramMessage(
      deps.botToken,
      deps.chatId,
      `🔄 <b>Scheduled:</b>\n\n${escapeHtml(responseText).slice(0, 4000)}`,
    );
  }

  // Update last_fire_at and last_result
  const now = Date.now();
  await deps.db.execute({
    sql: 'UPDATE scheduled_prompts SET last_fire_at = ?, last_result = ? WHERE id = ?',
    args: [now, responseText.slice(0, 5000), scheduledPromptId],
  });

  // Compute and set next fire time, then re-schedule
  const nextFireAt = now + intervalSec * 1000;
  await deps.db.execute({
    sql: 'UPDATE scheduled_prompts SET next_fire_at = ? WHERE id = ?',
    args: [nextFireAt, scheduledPromptId],
  });

  // Re-enqueue for the next fire
  const queue = getScheduledPromptQueue();
  if (queue) {
    queue
      .add(
        QUEUE_NAMES.SCHEDULED_PROMPT_FIRE,
        { tenantId, scheduledPromptId },
        { delay: intervalSec * 1000, jobId: scheduledPromptJobId(tenantId, scheduledPromptId) },
      )
      .catch((err) => {
        console.warn(`[scheduled-prompt-fire] re-enqueue failed for ${scheduledPromptId}: ${err}`);
      });
  }

  return { status: 'fired', responseText };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function scheduledPromptFireProcessor(
  job: Job<ScheduledPromptFireJob>,
): Promise<FireResult> {
  const { getDb } = await import('../db.ts');
  return runScheduledPromptFire(
    {
      db: getDb(),
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? null,
      chatId: process.env.TELEGRAM_OWNER_CHAT_ID ?? null,
    },
    job.data,
  );
}
