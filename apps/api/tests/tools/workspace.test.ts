import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { runTool } from '../run-tool.js';

describe('customer workspace tools', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
  });

  describe('createCustomerWorkspace', () => {
    it('creates data/workspaces/{tenantId}/customer/ directory structure', async () => {
      const { createCustomerWorkspace } = await import(
        '../../src/mastra/tools/customer/workspace.js'
      );
      const ws = createCustomerWorkspace(DEFAULT_TENANT_ID);
      expect(ws).toBeDefined();
    });
  });

  describe('logConversation', () => {
    it('logs an inbound message', async () => {
      const { createLogConversationTool } = await import(
        '../../src/mastra/tools/customer/workspace.js'
      );
      const db = getDb();
      const logConversation = createLogConversationTool({ db, tenantId: DEFAULT_TENANT_ID });

      const result = await runTool(logConversation, {
        channel: 'whatsapp',
        customerPhone: '+6281234567890',
        direction: 'inbound',
        message: 'Halo, apa kabar?',
      });

      expect(result.ok).toBe(true);
      expect(result.conversationId).toBeDefined();
    });

    it('logs an outbound message', async () => {
      const { createLogConversationTool } = await import(
        '../../src/mastra/tools/customer/workspace.js'
      );
      const db = getDb();
      const logConversation = createLogConversationTool({ db, tenantId: DEFAULT_TENANT_ID });

      const result = await runTool(logConversation, {
        channel: 'whatsapp',
        customerPhone: '+6281234567890',
        direction: 'outbound',
        message: 'Halo! Ada yang bisa saya bantu?',
      });

      expect(result.ok).toBe(true);
    });

    it('persists the logged message in the database', async () => {
      const { createLogConversationTool } = await import(
        '../../src/mastra/tools/customer/workspace.js'
      );
      const db = getDb();
      const logConversation = createLogConversationTool({ db, tenantId: DEFAULT_TENANT_ID });

      await runTool(logConversation, {
        channel: 'whatsapp',
        customerPhone: '+6289988777666',
        direction: 'inbound',
        message: 'Pesan test',
      });

      const rows = await db.execute({
        sql: "SELECT * FROM conversations WHERE customer_phone = '+6289988777666'",
        args: [],
      });
      expect(rows.rows.length).toBeGreaterThan(0);
      expect(rows.rows[0]!.message).toBe('Pesan test');
    });
  });
});
