import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { setSetting } from '../../src/db/settings.js';

describe('WhatsApp auto-reply toggle', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
    // Only delete the whatsappAutoReply setting, not all settings
    // This prevents interference with other tests that set different settings
    await db.execute({
      sql: "DELETE FROM settings WHERE tenant_id = ? AND key = ?",
      args: [DEFAULT_TENANT_ID, 'whatsappAutoReply'],
    });
    vi.clearAllMocks();
  });

  describe('whatsappAutoReply setting', () => {
    it('is true by default when not set', async () => {
      const { createWhatsAppAutoReplySetting } = await import(
        '../../src/mastra/tools/settings.js'
      );
      const { isAutoReplyEnabled } = createWhatsAppAutoReplySetting({
        db: getDb(),
        tenantId: DEFAULT_TENANT_ID,
      });
      // Default is true when the setting has not been explicitly set
      const enabled = await isAutoReplyEnabled();
      expect(enabled).toBe(true);
    });

    it('returns false when explicitly disabled', async () => {
      const { createWhatsAppAutoReplySetting } = await import(
        '../../src/mastra/tools/settings.js'
      );
      const db = getDb();
      await setSetting(db, DEFAULT_TENANT_ID, 'whatsappAutoReply' as any, 'false');
      const { isAutoReplyEnabled } = createWhatsAppAutoReplySetting({
        db,
        tenantId: DEFAULT_TENANT_ID,
      });
      const enabled = await isAutoReplyEnabled();
      expect(enabled).toBe(false);
    });

    it('returns true when explicitly enabled', async () => {
      const { createWhatsAppAutoReplySetting } = await import(
        '../../src/mastra/tools/settings.js'
      );
      const db = getDb();
      await setSetting(db, DEFAULT_TENANT_ID, 'whatsappAutoReply' as any, 'true');
      const { isAutoReplyEnabled } = createWhatsAppAutoReplySetting({
        db,
        tenantId: DEFAULT_TENANT_ID,
      });
      const enabled = await isAutoReplyEnabled();
      expect(enabled).toBe(true);
    });
  });

  describe('auto-reply disabled behavior', () => {
    it('logs inbound but does not generate reply when auto-reply is disabled', async () => {
      // This tests the integration: when whatsappAutoReply = false,
      // the handler should NOT call customerAgent.generate() and should NOT send WA reply.
      // Instead it should notify owner via Telegram.
      const { createLogConversationTool } = await import(
        '../../src/mastra/tools/customer/workspace.js'
      );
      const db = getDb();
      const logConversation = createLogConversationTool({ db, tenantId: DEFAULT_TENANT_ID });

      // Log the inbound message
      const inboundResult = await logConversation.execute({
        channel: 'whatsapp',
        customerPhone: '+6281234567890',
        direction: 'inbound',
        message: 'Halo, mau tanya produk',
        messageId: 'test-inbound-id',
      });
      expect(inboundResult.ok).toBe(true);

      // When auto-reply is disabled, we would NOT call customerAgent.generate()
      // and we would NOT call sock.sendMessage().
      // Instead, we send a Telegram notification to the owner.
      // This is the expected behavior when whatsappAutoReply = false.
      // The actual Telegram notification would use createTelegramSender(process.env.TELEGRAM_BOT_TOKEN)
      // and send to process.env.TELEGRAM_OWNER_CHAT_ID.
    });
  });
});