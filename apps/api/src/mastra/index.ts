import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { DATABASE_URL, getDb } from '../db/client.js';
import { initSchema } from '../db/schema.js';
import { getSetting } from '../db/settings.js';
import { juraganAgent } from './agents/juragan.js';
import { apiRoutes } from './api-routes.js';

const db = getDb();
await initSchema(db);

// Onboarding: if the API key was saved via /custom/settings before any env var, promote it
// into process.env so the model router picks it up. Env still wins if both are set.
const tenantId = process.env.DEFAULT_TENANT_ID ?? 'default';
if (!process.env.OPENROUTER_API_KEY) {
  const stored = await getSetting(db, tenantId, 'openrouterApiKey');
  if (stored) process.env.OPENROUTER_API_KEY = stored;
}

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'juragan-store',
    url: DATABASE_URL,
  }),
  agents: { juragan: juraganAgent },
  workflows: {},
  bundler: {
    transpilePackages: ['@juragan/shared'],
  },
  server: {
    apiRoutes,
  },
});
