import { QUEUE_NAMES, createRedisConnection } from '@juragan/queue';
import { Worker } from 'bullmq';
import { reminderFireProcessor } from './handlers/reminder-fire.ts';

const connection = createRedisConnection();

const reminderWorker = new Worker(QUEUE_NAMES.REMINDER_FIRE, reminderFireProcessor, {
  connection,
  concurrency: 4,
});

reminderWorker.on('completed', (job, result) => {
  console.log(`[reminder-fire] ${job.id} → ${JSON.stringify(result)}`);
});

reminderWorker.on('failed', (job, err) => {
  console.error(`[reminder-fire] ${job?.id} FAILED (attempt ${job?.attemptsMade}):`, err.message);
});

reminderWorker.on('error', (err) => {
  console.error('[reminder-fire] worker error:', err.message);
});

console.log('[worker] started. queues:', Object.values(QUEUE_NAMES));

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, closing…`);
  await reminderWorker.close();
  await connection.quit();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
