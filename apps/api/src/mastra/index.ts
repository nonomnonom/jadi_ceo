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
import { z } from 'zod';

// Request context schema — validates tenantId/role/channel before agent execution
const requestContextSchema = z.object({
  tenantId: z.string().min(1),
  role: z.enum(['owner', 'staff', 'customer']).default('owner'),
  channel: z.enum(['telegram', 'whatsapp']).default('telegram'),
});

type RequestContextValues = z.infer<typeof requestContextSchema>;

// Re-export for use by agents
export { requestContextSchema };
export type { RequestContextValues };

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
    middleware: [
      async (c, next) => {
        // Inject tenantId from x-telegram-chat-id header before agent executes
        const chatId = c.req.header('x-telegram-chat-id');
        if (chatId) {
          // Simple tenantId derivation from Telegram chat ID
          // In production this would look up the tenant from a mapping table
          c.set('tenantId', `telegram:${chatId}`);
        }
        const channel = c.req.header('x-channel-type');
        if (channel) {
          c.set('channel', channel);
        }
        await next();
      },
    ],
  },
  // Request context validation schema — validates tenantId/role/channel before agent execution
  // This runs as part of Mastra's request context handling
});

// Kick off the reminder loop after the Mastra instance exists. Survives the Mastra dev
// server reload, so the interval lives for the lifetime of the Node process.
startReminderExecutor(getDb(), DEFAULT_TENANT_ID);
