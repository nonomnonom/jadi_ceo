import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { DATABASE_URL, getDb } from '../db/client.js';
import { initSchema } from '../db/schema.js';
import { juraganAgent } from './agents/juragan.js';

await initSchema(getDb());

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
});
