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
import { ownerSupervisor } from './agents/owner-supervisor.js';
import { apiRoutes } from './api-routes.js';
import { registerAcpRoutes } from './acp-routes.js';
import { getAcpSessionManager, type AgentExecutor, type AgentOutput } from '@juragan/core';
import { getPluginManager } from '@juragan/core';
import { orderApprovalWorkflow } from '../workflows/order-approval.js';
import { restockWorkflow } from '../workflows/restock.js';
import { customerFollowupWorkflow } from '../workflows/customer-followup.js';

registerAcpRoutes();

// Discover and load plugins at startup
async function loadPlugins(): Promise<void> {
  const manager = getPluginManager();
  const discovered = await manager.discover(['plugins/']);
  for (const plugin of discovered) {
    try {
      await manager.load(plugin.manifest.id, plugin.entryPath);
      console.log(`[plugin] loaded: ${plugin.manifest.id} v${plugin.manifest.version}`);
    } catch (err) {
      console.error(`[plugin] failed to load ${plugin.manifest.id}:`, err);
    }
  }
  const channels = manager.getChannels();
  if (channels.length > 0) {
    console.log(`[plugin] ${channels.length} channel(s) registered: ${channels.map((c) => c.id).join(', ')}`);
  }
}
void loadPlugins();

// Wire ACP executor to Mastra agents — enables spawn/sub-agent stream relay
const manager = getAcpSessionManager();
manager.setExecutor(
  (async (agentId: string, input): Promise<AsyncGenerator<AgentOutput>> => {
    const agent = agentId === 'customer' ? customerAgent : ownerSupervisor;
    const stream = await agent.stream(input.text ?? '', { maxSteps: 50 });

    async function* acpStream(): AsyncGenerator<AgentOutput> {
      try {
        for await (const text of stream.textStream) {
          yield { type: 'delta', delta: text };
        }
        yield { type: 'done', text: '' };
      } catch (err) {
        yield { type: 'error', error: err instanceof Error ? err.message : String(err) };
      }
    }
    return acpStream();
  }) as AgentExecutor,
);

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'juragan-store',
    url: DATABASE_URL,
  }),
  agents: { ownerSupervisor, customer: customerAgent },
  workflows: {
    orderApproval: orderApprovalWorkflow,
    restock: restockWorkflow,
    customerFollowup: customerFollowupWorkflow,
  },
  bundler: {
    transpilePackages: ['@juragan/shared'],
    externals: ['baileys', '@juragan/queue', 'msgpackr-extract'],
  },
  server: {
    apiRoutes,
  },
});

// Kick off the reminder loop after the Mastra instance exists. Survives the Mastra dev
// server reload, so the interval lives for the lifetime of the Node process.
startReminderExecutor(getDb(), DEFAULT_TENANT_ID);
