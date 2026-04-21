import { Queue, type QueueOptions } from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';

export const QUEUE_NAMES = {
  REMINDER_FIRE: 'reminder-fire',
} as const;

export type ReminderFireJob = {
  tenantId: string;
  reminderId: number;
};

export type QueueJobMap = {
  [QUEUE_NAMES.REMINDER_FIRE]: ReminderFireJob;
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

let _reminderQueue: Queue<ReminderFireJob> | null = null;
let _reminderConnection: Redis | null = null;

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
}
