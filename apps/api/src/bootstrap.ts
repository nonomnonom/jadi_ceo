import { getDb } from './db/client.js';
import { initSchema } from './db/schema.js';
import { getSetting } from './db/settings.js';

// Runs BEFORE any module that reads these env vars at construction time (Telegram adapter,
// OpenRouter model router). Top-level await here blocks downstream imports until the
// promotion is complete.
const db = getDb();
await initSchema(db);

const tenantId = process.env.DEFAULT_TENANT_ID ?? 'default';

if (!process.env.OPENROUTER_API_KEY) {
  const stored = await getSetting(db, tenantId, 'openrouterApiKey');
  if (stored) process.env.OPENROUTER_API_KEY = stored;
}

if (!process.env.TELEGRAM_BOT_TOKEN) {
  const stored = await getSetting(db, tenantId, 'telegramBotToken');
  if (stored) process.env.TELEGRAM_BOT_TOKEN = stored;
}
