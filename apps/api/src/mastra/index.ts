import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import '@juragan/shared';

export const mastra = new Mastra({
  storage: new LibSQLStore({ id: 'juragan-store', url: ':memory:' }),
  agents: {},
  workflows: {},
  bundler: {
    transpilePackages: ['@juragan/shared'],
  },
});
