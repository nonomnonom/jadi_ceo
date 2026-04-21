import { Queue, type QueueOptions } from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';

export const QUEUE_NAMES = {
  REMINDER_FIRE: 'reminder-fire',
  SCHEDULED_PROMPT_FIRE: 'scheduled-prompt-fire',
} as const;

export type ReminderFireJob = {
  tenantId: string;
  reminderId: number;
};

export type ScheduledPromptFireJob = {
  tenantId: string;
  scheduledPromptId: number;
};

export type QueueJobMap = {
  [QUEUE_NAMES.REMINDER_FIRE]: ReminderFireJob;
  [QUEUE_NAMES.SCHEDULED_PROMPT_FIRE]: ScheduledPromptFireJob;
};

export const DEFAULT_REDIS_URL = 'redis://localhost:6379';

/**
 * BullMQ requires maxRetriesPerRequest: null. Worker connections also need
 * enableReadyCheck: false per BullMQ's docs for blocking commands.
 */
export function createRedisConnection(
  url = process.env.REDIS_URL ?? DEFAULT_REDIS_URL,
  overrides: RedisOptions = {},
): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...overrides,
  });
}

export function makeQueueOptions(connection: Redis): QueueOptions {
  return {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  };
}

/**
 * Build a deterministic jobId so duplicate enqueues collapse to a single job.
 * This makes producer calls idempotent.
 */
export function reminderJobId(tenantId: string, reminderId: number): string {
  return `reminder:${tenantId}:${reminderId}`;
}

export function scheduledPromptJobId(tenantId: string, scheduledPromptId: number): string {
  return `sched-prompt:${tenantId}:${scheduledPromptId}`;
}

let _reminderQueue: Queue<ReminderFireJob> | null = null;
let _scheduledPromptQueue: Queue<ScheduledPromptFireJob> | null = null;
let _reminderConnection: Redis | null = null;
let _scheduledPromptConnection: Redis | null = null;

/**
 * Lazily construct the reminder-fire queue the API uses as a producer.
 * Returns null if Redis URL is blank (tests, CI). Callers should treat null
 * as "not enqueued" — fallback paths must still work.
 */
export function getReminderQueue(): Queue<ReminderFireJob> | null {
  if (_reminderQueue) return _reminderQueue;
  const url = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
  if (!url) return null;
  _reminderConnection = createRedisConnection(url);
  _reminderQueue = new Queue<ReminderFireJob>(
    QUEUE_NAMES.REMINDER_FIRE,
    makeQueueOptions(_reminderConnection),
  );
  // Prevent unhandled error on Redis down — callers already no-op on enqueue failure.
  _reminderConnection.on('error', () => {});
  return _reminderQueue;
}

export async function closeReminderQueue(): Promise<void> {
  if (_reminderQueue) {
    await _reminderQueue.close();
    _reminderQueue = null;
  }
  if (_reminderConnection) {
    await _reminderConnection.quit().catch(() => {});
    _reminderConnection = null;
  }
  if (_scheduledPromptQueue) {
    await _scheduledPromptQueue.close();
    _scheduledPromptQueue = null;
  }
  if (_scheduledPromptConnection) {
    await _scheduledPromptConnection.quit().catch(() => {});
    _scheduledPromptConnection = null;
  }
}

/**
 * Lazily construct the scheduled-prompt-fire queue. Returns null if REDIS_URL is blank.
 */
export function getScheduledPromptQueue(): Queue<ScheduledPromptFireJob> | null {
  if (_scheduledPromptQueue) return _scheduledPromptQueue;
  const url = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
  if (!url) return null;
  _scheduledPromptConnection = createRedisConnection(url);
  _scheduledPromptQueue = new Queue<ScheduledPromptFireJob>(
    QUEUE_NAMES.SCHEDULED_PROMPT_FIRE,
    makeQueueOptions(_scheduledPromptConnection),
  );
  _scheduledPromptConnection.on('error', () => {});
  return _scheduledPromptQueue;
}
