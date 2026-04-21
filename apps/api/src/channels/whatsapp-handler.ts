import { type WASocket, proto } from 'baileys';
import { customerAgent } from '../mastra/agents/customer/index.js';
import { getDb } from '../db/client.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { createLogConversationTool } from '../mastra/tools/customer/workspace.js';
import { createWhatsAppAutoReplySetting } from '../mastra/tools/settings.js';
import { createTelegramSender } from '../reminders/executor.js';
import { isWithinBusinessHours, isInVacationMode } from '../db/settings.js';

const db = getDb();
const logConversation = createLogConversationTool({ db, tenantId: DEFAULT_TENANT_ID });
const { isAutoReplyEnabled } = createWhatsAppAutoReplySetting({ db, tenantId: DEFAULT_TENANT_ID });

const QR_IMAGE_PREFIX = '[QR_IMAGE]data:image/png;base64,';

function extractQrImage(text: string): { caption: string; imageData: string } | null {
  const marker = QR_IMAGE_PREFIX;
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  const imageData = text.slice(idx + marker.length);
  const caption = text.slice(0, idx).trim();
  return { caption, imageData };
}

function formatIDR(n: number): string {
  return `Rp ${n.toLocaleString('id-ID', { minimumFractionDigits: 0 })}`;
}

export function createWhatsAppHandler(sock: WASocket): void {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    // Check auto-reply setting once per batch
    const autoReplyEnabled = await isAutoReplyEnabled();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const ownerChatId = process.env.TELEGRAM_OWNER_CHAT_ID;

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

      if (!autoReplyEnabled) {
        // Notify owner via Telegram instead of auto-replying
        if (botToken && ownerChatId) {
          const send = createTelegramSender(botToken);
          const safePhone = phone.replace(/^\+/, '');
          await send(
            ownerChatId,
            `📩 <b>Pesan WhatsApp baru (auto-reply OFF)</b>\n\nDari: <code>${safePhone}</code>\nPesan: ${textContent.slice(0, 500)}`,
          );
        }
        continue; // skip auto-reply
      }

      // Check vacation mode first
      const vacationStatus = await isInVacationMode(db, DEFAULT_TENANT_ID);
      if (vacationStatus.active && vacationStatus.message) {
        await sock.sendMessage(senderJid, { text: vacationStatus.message });
        await logConversation.execute({
          channel: 'whatsapp',
          customerPhone: phone,
          direction: 'outbound',
          message: vacationStatus.message,
          messageId: undefined,
        });
        continue;
      }

      // Check business hours
      const withinBusinessHours = await isWithinBusinessHours(db, DEFAULT_TENANT_ID);
      if (!withinBusinessHours) {
        const hoursResult = await db.execute({
          sql: "SELECT value FROM settings WHERE tenant_id = ? AND key IN ('businessHoursStart', 'businessHoursEnd')",
          args: [DEFAULT_TENANT_ID],
        });
        let start = '09:00';
        let end = '21:00';
        for (const row of hoursResult.rows) {
          const key = String(row.key);
          const val = String(row.value);
          if (key === 'businessHoursStart') start = val;
          if (key === 'businessHoursEnd') end = val;
        }
        const offlineMessage = `Halo! Terima kasih sudah menghubungi. Saat ini kami sedang di luar jam operasional (${start} - ${end} WIB). Pesan Anda akan kami respon saat jam operasional.`;
        await sock.sendMessage(senderJid, { text: offlineMessage });
        await logConversation.execute({
          channel: 'whatsapp',
          customerPhone: phone,
          direction: 'outbound',
          message: offlineMessage,
          messageId: undefined,
        });
        continue;
      }

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

      // Check for QR image data in agent response
      const qrData = extractQrImage(replyText);
      if (qrData) {
        // Send as WhatsApp image (base64 PNG)
        const buffer = Buffer.from(qrData.imageData, 'base64');
        await sock.sendMessage(senderJid, {
          image: buffer,
          caption: qrData.caption || undefined,
        });
      } else {
        // Send as regular text reply
        await sock.sendMessage(senderJid, { text: replyText });
      }

      // Log outbound
      await logConversation.execute({
        channel: 'whatsapp',
        customerPhone: phone,
        direction: 'outbound',
        message: replyText,
        messageId: undefined,
      });
    }
  });
}