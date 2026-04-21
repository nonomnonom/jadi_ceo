// Bootstrap must come first: it runs schema init + promotes DB-stored credentials into
// process.env before any downstream module (agent, Telegram adapter) reads them at
// construction time. Top-level await inside bootstrap blocks these later imports.
import '../bootstrap.js';

import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { DATABASE_URL } from '../db/client.js';
import { juraganAgent } from './agents/juragan.js';
import { apiRoutes } from './api-routes.js';

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
