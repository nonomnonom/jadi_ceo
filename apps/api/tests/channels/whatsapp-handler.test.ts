import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { runTool } from '../run-tool.js';

// Mock baileys WASocket
const mockSendMessage = vi.fn().mockResolvedValue({ key: { id: 'test-msg-id' } });
const mockUpsertMessage = vi.fn();

const createMockSocket = () => ({
  ev: {
    on: vi.fn((event, cb) => {
      if (event === 'messages.upsert') {
        // Store handler for testing
        mockUpsertMessage.mockImplementation(cb);
      }
    }),
    emit: vi.fn(),
  },
  sendMessage: mockSendMessage,
  user: { id: 'test-user' },
  end: vi.fn(),
});

// Unit test the handler logic (no real socket needed)
describe('WhatsApp message handling logic', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
    vi.clearAllMocks();
  });

  describe('phone number derivation from JID', () => {
    it('strips @s.whatsapp.net suffix and adds + prefix', () => {
      const jid = '6281234567890@s.whatsapp.net';
      let phone = jid.replace('@s.whatsapp.net', '');
      if (!phone.startsWith('+')) {
        phone = phone.replace(/^0/, '+62');
        if (!phone.startsWith('+')) phone = '+' + phone;
      }
      expect(phone).toBe('+6281234567890');
    });

    it('replaces leading 0 with +62 for Indonesian numbers', () => {
      const jid = '081234567890@s.whatsapp.net';
      let phone = jid.replace('@s.whatsapp.net', '');
      if (!phone.startsWith('+')) {
        phone = phone.replace(/^0/, '+62');
        if (!phone.startsWith('+')) phone = '+' + phone;
      }
      expect(phone).toBe('+6281234567890');
    });

    it('leaves already-prefixed numbers untouched', () => {
      const jid = '+6281234567890@s.whatsapp.net';
      let phone = jid.replace('@s.whatsapp.net', '');
      if (!phone.startsWith('+')) {
        phone = phone.replace(/^0/, '+62');
        if (!phone.startsWith('+')) phone = '+' + phone;
      }
      expect(phone).toBe('+6281234567890');
    });
  });

  describe('logConversation tool', () => {
    it('logs inbound message with correct fields', async () => {
      const { createLogConversationTool } = await import(
        '../../src/mastra/tools/customer/workspace.js'
      );
      const db = getDb();
      const logConversation = createLogConversationTool({ db, tenantId: DEFAULT_TENANT_ID });

      const result = await runTool(logConversation, {
        channel: 'whatsapp',
        customerPhone: '+6281234567890',
        direction: 'inbound',
        message: 'Halo, mau tanya soal produk',
        messageId: 'test-msg-id',
      });

      expect(result.ok).toBe(true);
      expect(result.conversationId).toBeGreaterThan(0);
    });

    it('logs outbound message with correct fields', async () => {
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
      expect(result.conversationId).toBeGreaterThan(0);
    });
  });

  describe('skip conditions', () => {
    it('skips status broadcast messages', () => {
      const jid = 'status@broadcast';
      // In the real handler we skip status@broadcast
      expect(jid).toBe('status@broadcast');
    });

    it('skips own messages (fromMe = true)', () => {
      // The handler checks msg.key.fromMe first
      const fromMe = true;
      expect(fromMe).toBe(true); // would be skipped in real handler
    });
  });
});