// Bootstrap must come first: it runs schema init + promotes DB-stored credentials into
// process.env before any downstream module (agent, Telegram adapter) reads them at
// construction time. Top-level await inside bootstrap blocks these later imports.
import '../bootstrap.js';

import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { DATABASE_URL, getDb } from '../db/client.js';
import { startReminderExecutor } from '../reminders/executor.js';
import { customerAgent } from './agents/customer/index.js';
import { juraganAgent } from './agents/juragan.js';
import { apiRoutes } from './api-routes.js';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'juragan-store',
    url: DATABASE_URL,
  }),
  agents: { juragan: juraganAgent, customer: customerAgent },
  workflows: {},
  bundler: {
    transpilePackages: ['@juragan/shared'],
  },
  server: {
    apiRoutes,
  },
});

// Kick off the reminder loop after the Mastra instance exists. Survives the Mastra dev
// server reload, so the interval lives for the lifetime of the Node process.
startReminderExecutor(getDb(), DEFAULT_TENANT_ID);
