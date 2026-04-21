import { QUEUE_NAMES, type ScheduledPromptFireJob, getScheduledPromptQueue, scheduledPromptJobId } from '@juragan/queue';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../db/client.js';

export type ScheduledPromptToolDeps = { db: Db; tenantId: string };

// ─── Interval parser ────────────────────────────────────────────────────────

type ParsedInterval = { intervalSec: number; cronExpr: string; nextFireAt: number };

/**
 * Parse natural-ish interval strings into seconds + cron expression.
 * Supports: "5m", "1h", "daily", "9am", "every monday 9am", "every 5 minutes"
 */
export function parseIntervalToCron(
  interval: string,
  now: number = Date.now(),
): ParsedInterval {
  const s = interval.trim().toLowerCase();

  // every N minutes/hours/days
  const everyMatch = s.match(/^every\s+(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks)$/);
  if (everyMatch) {
    const val = Number(everyMatch[1]);
    const unit = everyMatch[2];
    const secMap: Record<string, number> = {
      minute: 60, minutes: 60,
      hour: 3600, hours: 3600,
      day: 86400, days: 86400,
      week: 604800, weeks: 604800,
    };
    const intervalSec = val * (secMap[unit ?? ''] ?? 60);
    return { intervalSec, cronExpr: `*/${Math.floor(intervalSec / 60)} * * * *`, nextFireAt: now + intervalSec * 1000 };
  }

  // short forms: 5m, 1h, 30s
  const shortMatch = s.match(/^(\d+)\s*(s|sec|seconds|m|min|minutes|h|hours|d|days)$/);
  if (shortMatch) {
    const val = Number(shortMatch[1]);
    const unit = shortMatch[2];
    const secMap: Record<string, number> = { s: 1, sec: 1, seconds: 1, m: 60, min: 60, minutes: 60, h: 3600, hours: 3600, d: 86400, days: 86400 };
    const intervalSec = val * (secMap[unit ?? ''] ?? 60);
    return { intervalSec, cronExpr: `*/${Math.floor(intervalSec / 60)} * * * *`, nextFireAt: now + intervalSec * 1000 };
  }

  // daily / every day
  if (s === 'daily' || s === 'every day') {
    const intervalSec = 86400;
    return { intervalSec, cronExpr: '0 9 * * *', nextFireAt: nextCronFire('0 9 * * *', now) };
  }

  // weekdays 9am
  const weekdayMatch = s.match(/^(?:every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (weekdayMatch) {
    const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const dayKey = (weekdayMatch[1] ?? '').toLowerCase();
    const day = dayMap[dayKey] ?? 0;
    let hour = Number(weekdayMatch[2]);
    const min = Number(weekdayMatch[3] ?? 0);
    const ampm = (weekdayMatch[4] ?? '').toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    const intervalSec = 604800;
    return { intervalSec, cronExpr: `${min} ${hour} * * ${day}`, nextFireAt: nextCronFire(`${min} ${hour} * * ${day}`, now) };
  }

  // time-only: 9am, 14:30
  const timeMatch = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const min = Number(timeMatch[2] ?? 0);
    const ampm = (timeMatch[3] ?? '').toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    const intervalSec = 86400;
    return { intervalSec, cronExpr: `${min} ${hour} * * *`, nextFireAt: nextCronFire(`${min} ${hour} * * *`, now) };
  }

  // default: treat as minutes
  const numMatch = s.match(/^(\d+)$/);
  if (numMatch) {
    const intervalSec = Math.max(60, Number(numMatch[1]) * 60);
    return { intervalSec, cronExpr: `*/${Math.floor(intervalSec / 60)} * * * *`, nextFireAt: now + intervalSec * 1000 };
  }

  // fallback: 60 seconds
  return { intervalSec: 60, cronExpr: '* * * * *', nextFireAt: now + 60_000 };
}

/** Compute next fire time for a cron expression (local timezone). */
function nextCronFire(cronExpr: string, now: number): number {
  const parts = cronExpr.split(' ').map(Number);
  const min = parts[0] ?? 0;
  const hour = parts[1] ?? 0;
  const dayOfWeek = parts[4];
  const d = new Date(now);
  d.setSeconds(0, 0);
  const nowMin = d.getMinutes();
  const nowHour = d.getHours();
  const nowDayOfWeek = d.getDay();

  // Earliest next fire: either today at the time or tomorrow
  const targetMin = min;
  const targetHour = hour;
  let daysAhead = 0;

  if (dayOfWeek !== undefined && !Number.isNaN(dayOfWeek)) {
    // Specific day of week
    const daysUntil = ((dayOfWeek - nowDayOfWeek) + 7) % 7;
    daysAhead = daysUntil === 0 && (hour > nowHour || (hour === nowHour && min > nowMin)) ? 0 : daysUntil;
  } else {
    // Daily
    if (hour > nowHour || (hour === nowHour && min > nowMin)) {
      daysAhead = 0;
    } else {
      daysAhead = 1;
    }
  }

  d.setDate(d.getDate() + daysAhead);
  d.setHours(targetHour, targetMin, 0, 0);
  return d.getTime();
}

// ─── Enqueue helper ──────────────────────────────────────────────────────────

async function enqueueScheduledPromptFire(
  tenantId: string,
  scheduledPromptId: number,
  nextFireAt: number,
): Promise<void> {
  const queue = getScheduledPromptQueue();
  if (!queue) return;
  const delay = Math.max(0, nextFireAt - Date.now());
  const job: ScheduledPromptFireJob = { tenantId, scheduledPromptId };
  try {
    await queue.add(QUEUE_NAMES.SCHEDULED_PROMPT_FIRE, job, {
      delay,
      jobId: scheduledPromptJobId(tenantId, scheduledPromptId),
    });
  } catch (err) {
    console.warn(
      `[schedule-prompt] enqueue failed: ${err instanceof Error ? err.message : err}`,
    );
  }
}

// ─── Schema types ────────────────────────────────────────────────────────────

const ScheduledPromptSchema = z.object({
  id: z.number().int(),
  prompt: z.string(),
  intervalSec: z.number().int(),
  cronExpr: z.string(),
  nextFireAt: z.number().int(),
  active: z.boolean(),
  lastFireAt: z.number().int().nullable(),
  lastResult: z.string().nullable(),
  createdAt: z.number().int(),
});

// ─── Tools ────────────────────────────────────────────────────────────────────

export function createScheduledPromptTools({ db, tenantId }: ScheduledPromptToolDeps) {
  const schedulePrompt = createTool({
    id: 'schedule-prompt',
    description:
      'Jadwalkan prompt untuk jalan otomatis pada interval. ' +
      'Contoh: "every 5 minutes cek stok", "daily 9am ringkasan", "every monday 9am laporan minggu ini". ' +
      'Owner akan dapat hasil di Telegram.',
    inputSchema: z.object({
      prompt: z.string().min(1).max(1000),
      interval: z.string().min(1).max(100),
    }),
    outputSchema: ScheduledPromptSchema,
    execute: async ({ prompt: promptText, interval }) => {
      const now = Date.now();
      const { intervalSec, cronExpr, nextFireAt } = parseIntervalToCron(interval, now);
      const createdAt = now;

      const result = await db.execute({
        sql: `INSERT INTO scheduled_prompts
                (tenant_id, prompt, interval_sec, cron_expr, next_fire_at, active, created_at)
              VALUES (?, ?, ?, ?, ?, 1, ?) RETURNING id`,
        args: [tenantId, promptText, intervalSec, cronExpr, nextFireAt, createdAt],
      });
      const row = result.rows[0];
      if (!row) throw new Error('Gagal menyimpan scheduled prompt');
      const id = Number(row.id);

      // Best-effort enqueue — executor fallback will catch it if BullMQ fails
      void enqueueScheduledPromptFire(tenantId, id, nextFireAt);

      return {
        id,
        prompt: promptText,
        intervalSec,
        cronExpr,
        nextFireAt,
        active: true,
        lastFireAt: null,
        lastResult: null,
        createdAt,
      };
    },
  });

  const listScheduledPrompts = createTool({
    id: 'list-scheduled-prompts',
    description:
      'Lihat semua scheduled prompt yang aktif. ' +
      'Gunakan saat owner bertanya "scheduled prompt apa aja yang jalan" atau "cek jadwal automation".',
    inputSchema: z.object({}),
    outputSchema: z.object({ prompts: z.array(ScheduledPromptSchema) }),
    execute: async () => {
      const result = await db.execute({
        sql: `SELECT id, prompt, interval_sec, cron_expr, next_fire_at,
                     active, last_fire_at, last_result, created_at
              FROM scheduled_prompts WHERE tenant_id = ? AND active = 1
              ORDER BY next_fire_at ASC`,
        args: [tenantId],
      });
      return {
        prompts: result.rows.map((r) => ({
          id: Number(r.id),
          prompt: String(r.prompt),
          intervalSec: Number(r.interval_sec),
          cronExpr: String(r.cron_expr),
          nextFireAt: Number(r.next_fire_at),
          active: Number(r.active) === 1,
          lastFireAt: r.last_fire_at != null ? Number(r.last_fire_at) : null,
          lastResult: r.last_result != null ? String(r.last_result) : null,
          createdAt: Number(r.created_at),
        })),
      };
    },
  });

  const cancelScheduledPrompt = createTool({
    id: 'cancel-scheduled-prompt',
    description: 'Batalkan scheduled prompt berdasarkan ID. ' +
      'Gunakan saat owner mau stop automation tertentu.',
    inputSchema: z.object({ id: z.number().int() }),
    outputSchema: z.object({ id: z.number().int(), cancelled: z.boolean() }),
    execute: async ({ id }) => {
      await db.execute({
        sql: 'UPDATE scheduled_prompts SET active = 0 WHERE id = ? AND tenant_id = ?',
        args: [id, tenantId],
      });
      return { id, cancelled: true };
    },
  });

  return { schedulePrompt, listScheduledPrompts, cancelScheduledPrompt };
}
