import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { LocalFilesystem, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type CustomerWorkspaceDeps = { db: Db; tenantId: string };

export function customerWorkspaceBasePath(tenantId: string): string {
  return resolve(process.cwd(), 'data', 'workspaces', tenantId, 'customer');
}

export function createCustomerWorkspace(tenantId: string): Workspace {
  const basePath = customerWorkspaceBasePath(tenantId);
  // Ensure sub-folders exist
  mkdirSync(resolve(basePath, 'conversations'), { recursive: true });
  mkdirSync(resolve(basePath, 'templates'), { recursive: true });
  mkdirSync(resolve(basePath, 'files'), { recursive: true });

  return new Workspace({
    filesystem: new LocalFilesystem({ basePath }),
    tools: {
      // Customer workspace is read-only for the agent (no destructive tools)
      [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { enabled: false },
      [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { enabled: false },
      [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: { enabled: false },
      [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { enabled: false },
    },
  });
}

export function createLogConversationTool({ db, tenantId }: CustomerWorkspaceDeps) {
  return createTool({
    id: 'log-conversation',
    description:
      'Catat pesan ke log percakapan. Gunakan untuk menyimpan semua chat inbound/outbound WhatsApp customer.',
    inputSchema: z.object({
      channel: z.enum(['whatsapp', 'telegram']),
      customerPhone: z.string().min(6),
      direction: z.enum(['inbound', 'outbound']),
      message: z.string().min(1),
      messageId: z.string().optional(),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      conversationId: z.number().int(),
    }),
    execute: async ({ channel, customerPhone, direction, message, messageId }) => {
      const now = Date.now();
      const result = await db.execute({
        sql: `INSERT INTO conversations (tenant_id, channel, customer_phone, direction, message, message_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [tenantId, channel, customerPhone, direction, message, messageId ?? null, now],
      });
      const row = result.rows[0];
      if (!row) throw new Error('Gagal menyimpan percakapan');
      return { ok: true, conversationId: Number(row.id) };
    },
  });
}
