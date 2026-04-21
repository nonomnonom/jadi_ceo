/**
 * WhatsApp Channel Plugin
 *
 * Registers WhatsApp messaging as a ChannelPlugin.
 * Uses the existing WhatsAppManager singleton for connection lifecycle,
 * and wires the ChannelPlugin adapters to the manager's existing methods.
 */

import type { ChannelPlugin } from '@juragan/plugin-sdk';
import { definePluginEntry } from '@juragan/plugin-sdk';
import { getWhatsAppManager } from '../../apps/api/src/channels/whatsapp-manager.js';

function makeWhatsAppChannelPlugin(): ChannelPlugin {
  return {
    id: 'whatsapp-channel',
    type: 'whatsapp',
    meta: {
      name: 'WhatsApp Channel',
      description: 'WhatsApp messaging via Baileys — QR pairing, auto-reply, reconnection',
    },
    adapters: {
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
