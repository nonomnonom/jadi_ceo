import { join } from 'node:path';
import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { getDb } from './db/client.js';
import { initSchema } from './db/schema.js';
import { getSetting } from './db/settings.js';
import { startDreamScheduler } from './scheduler/dream-scheduler.js';
import { getPluginManager } from '@juragan/core';

// Runs BEFORE any module that reads these env vars at construction time (Telegram adapter,
// OpenRouter model router). Top-level await here blocks downstream imports until the
// promotion is complete.
const db = getDb();
await initSchema(db);

if (!process.env.OPENROUTER_API_KEY) {
  const stored = await getSetting(db, tenantId, 'openrouterApiKey');
  if (stored) process.env.OPENROUTER_API_KEY = stored;
}

if (!process.env.TELEGRAM_BOT_TOKEN) {
  const stored = await getSetting(db, tenantId, 'telegramBotToken');
  if (stored) process.env.TELEGRAM_BOT_TOKEN = stored;
}

if (!process.env.TELEGRAM_OWNER_CHAT_ID) {
  const stored = await getSetting(db, tenantId, 'telegramOwnerChatId');
  if (stored) process.env.TELEGRAM_OWNER_CHAT_ID = stored;
}

// Discover and load plugins before agents/channels are initialized
const manager = getPluginManager();
const dirsToScan = [
  join(process.cwd(), 'plugins'),
  join(process.cwd(), 'node_modules', 'plugins'),
];
const discovered = await manager.discover(dirsToScan);
for (const plugin of discovered) {
  try {
    await manager.load(plugin.manifest.id, plugin.entryPath);
    console.log(`[bootstrap] loaded plugin: ${plugin.manifest.id}`);
  } catch (err) {
    console.error(`[bootstrap] failed to load plugin "${plugin.manifest.id}":`, err);
  }
}

// Auto-discover built-in skills from the skills/ directory
await manager.discoverSkills(join(process.cwd(), 'skills'));

// Start the dreaming scheduler for memory consolidation
const _stopDreamScheduler = startDreamScheduler({ db, tenantId });
