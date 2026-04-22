/**
 * WhatsApp Channel Plugin
 *
 * Registers WhatsApp messaging as a ChannelPlugin.
 * Uses the existing WhatsAppManager singleton for connection lifecycle,
 * and wires the ChannelPlugin adapters to the manager's existing methods.
 *
 * Messaging adapter wires Baileys incoming events → registered handler callback.
 */

import type { ChannelPlugin, ChannelMessagingAdapter, IncomingMessage, MessagingOptions } from '@juragan/plugin-sdk';
import { definePluginEntry } from '@juragan/plugin-sdk';
import { getWhatsAppManager } from '../../apps/api/src/channels/whatsapp-manager.js';

function normalizeBaileysMessage(msg: {
  key: { id?: string; remoteJid?: string; fromMe?: boolean };
  pushName?: string;
  message?: { conversation?: string; extendedTextMessage?: { text?: string } };
  messageTimestamp?: number;
}): IncomingMessage | null {
  if (!msg.key.remoteJid || msg.key.remoteJid === 'status@broadcast') return null;
  const textContent = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? '';
  if (!textContent) return null;

  let phone = msg.key.remoteJid.replace('@s.whatsapp.net', '');
  if (!phone.startsWith('+')) {
    phone = phone.replace(/^0/, '+62');
    if (!phone.startsWith('+')) phone = '+' + phone;
  }

  return {
    id: msg.key.id ?? `wa-${Date.now()}`,
    from: phone,
    body: textContent,
    timestamp: msg.messageTimestamp ?? Date.now(),
    channel: 'whatsapp',
    meta: { pushName: msg.pushName },
  };
}

function makeWhatsAppChannelPlugin(): ChannelPlugin {
  let messageHandler: ((msg: IncomingMessage) => void) | null = null;

  // Lazily register Baileys event listener when a handler is registered.
  // This avoids connecting to WhatsApp until there's actually a listener.
  function ensureListener(): void {
    const manager = getWhatsAppManager();
    const sock = manager.getSocket();
    if (!sock) return;

    // Only attach once — idempotent
    if ((sock as unknown as { _waPluginListener?: boolean })._waPluginListener) return;
    (sock as unknown as { _waPluginListener?: boolean })._waPluginListener = true;

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue; // skip own messages
        const normalized = normalizeBaileysMessage(msg);
        if (normalized && messageHandler) {
          messageHandler(normalized);
        }
      }
    });
  }

  const messagingAdapter: ChannelMessagingAdapter = {
    async sendMessage(to: string, text: string, options?: MessagingOptions): Promise<void> {
      const manager = getWhatsAppManager();
      await manager.sendMessageToJid(to, { text });
    },
    onMessage(handler: (message: IncomingMessage) => void): void {
      messageHandler = handler;
      // Trigger lazy listener attachment on the current socket
      ensureListener();
    },
  };

  return {
    id: 'whatsapp-channel',
    type: 'whatsapp',
    meta: {
      name: 'WhatsApp Channel',
      description: 'WhatsApp messaging via Baileys — QR pairing, auto-reply, reconnection',
    },
    adapters: {
      messaging: messagingAdapter,
      outbound: {
        async sendMessage(to: string, text: string) {
          const manager = getWhatsAppManager();
          await manager.sendMessageToJid(to, { text });
        },
      },
      status: {
        async getStatus() {
          const manager = getWhatsAppManager();
          const s = manager.getStatus();
          if (s.connected) return 'connected';
          if (s.qr) return 'connecting';
          return 'disconnected';
        },
      },
      pairing: {
        async getQRCode() {
          const manager = getWhatsAppManager();
          return manager.getStatus().qr ?? '';
        },
        async startPairing() {
          const manager = getWhatsAppManager();
          await manager.connect();
        },
        async stopPairing() {
          const manager = getWhatsAppManager();
          await manager.disconnect();
        },
      },
      lifecycle: {
        async connect() {
          const manager = getWhatsAppManager();
          await manager.connect();
        },
        async disconnect() {
          const manager = getWhatsAppManager();
          await manager.disconnect();
        },
      },
    },
  };
}

export default definePluginEntry(
  {
    id: 'whatsapp-channel',
    name: 'WhatsApp Channel',
    version: '1.0.0',
    description: 'WhatsApp messaging via Baileys',
  },
  (api) => {
    api.registerChannel(makeWhatsAppChannelPlugin());
  },
);
