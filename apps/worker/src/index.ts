import { QUEUE_NAMES, createRedisConnection } from '@juragan/queue';
import { Worker } from 'bullmq';
import { reminderFireProcessor } from './handlers/reminder-fire.ts';
import { scheduledPromptFireProcessor } from './handlers/scheduled-prompt-fire.ts';

const connection = createRedisConnection();

const reminderWorker = new Worker(QUEUE_NAMES.REMINDER_FIRE, reminderFireProcessor, {
  connection,
  concurrency: 4,
});

const scheduledPromptWorker = new Worker(
  QUEUE_NAMES.SCHEDULED_PROMPT_FIRE,
  scheduledPromptFireProcessor,
  {
    connection,
    concurrency: 2,
  },
);

reminderWorker.on('completed', (job, result) => {
  console.log(`[reminder-fire] ${job.id} → ${JSON.stringify(result)}`);
});

reminderWorker.on('failed', (job, err) => {
  console.error(`[reminder-fire] ${job?.id} FAILED (attempt ${job?.attemptsMade}):`, err.message);
});

reminderWorker.on('error', (err) => {
  console.error('[reminder-fire] worker error:', err.message);
});

scheduledPromptWorker.on('completed', (job, result) => {
  console.log(`[scheduled-prompt-fire] ${job.id} → ${JSON.stringify(result)}`);
});

scheduledPromptWorker.on('failed', (job, err) => {
  console.error(
    `[scheduled-prompt-fire] ${job?.id} FAILED (attempt ${job?.attemptsMade}):`,
    err.message,
  );
});

scheduledPromptWorker.on('error', (err) => {
  console.error('[scheduled-prompt-fire] worker error:', err.message);
});

console.log('[worker] started. queues:', Object.values(QUEUE_NAMES));

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, closing…`);
  await Promise.allSettled([
    reminderWorker.close(),
    scheduledPromptWorker.close(),
    connection.quit(),
  ]);
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
