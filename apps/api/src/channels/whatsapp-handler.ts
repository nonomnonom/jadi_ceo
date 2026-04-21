import { type WASocket, WAMessage } from 'baileys';
import { customerAgent } from '../mastra/agents/customer/index.js';
import { getDb } from '../db/client.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { createLogConversationTool } from '../mastra/tools/customer/workspace.js';

const db = getDb();
const logConversation = createLogConversationTool({ db, tenantId: DEFAULT_TENANT_ID });

export function createWhatsAppHandler(sock: WASocket): void {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Skip own messages (outbound from us)
      const isFromMe = msg.key.fromMe;
      if (isFromMe) continue;

      // Only handle text messages
      const textContent = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text;
      if (!textContent) continue;

      const senderJid = msg.key.remoteJid;
      if (!senderJid || senderJid === 'status@broadcast') continue;

      // Derive customer phone from JID (e.g. "6281234567890@s.whatsapp.net" → "+6281234567890")
      let phone = senderJid.replace('@s.whatsapp.net', '');
      if (!phone.startsWith('+')) {
        phone = phone.replace(/^0/, '+62');
        if (!phone.startsWith('+')) phone = '+' + phone;
      }

      // Log inbound
      await logConversation.execute({
        channel: 'whatsapp',
        customerPhone: phone,
        direction: 'inbound',
        message: textContent,
        messageId: msg.key.id ?? undefined,
      });

      // Run customer agent
      const response = await customerAgent.generate({
        text: textContent,
        context: {
          channel: 'whatsapp' as const,
          customerPhone: phone,
          messageId: msg.key.id ?? undefined,
        },
      });

      const replyText = typeof response.text === 'string' ? response.text : JSON.stringify(response.text);

      // Log outbound
      await logConversation.execute({
        channel: 'whatsapp',
        customerPhone: phone,
        direction: 'outbound',
        message: replyText,
        messageId: undefined,
      });

      // Send reply via WhatsApp
      await sock.sendMessage(senderJid, { text: replyText });
    }
  });
}