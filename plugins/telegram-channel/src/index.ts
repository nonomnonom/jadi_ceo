/**
 * Telegram Channel Plugin
 *
 * Registers Telegram bot as a ChannelPlugin using @chat-adapter/telegram.
 * Handles messaging (send/receive), status, and lifecycle adapters.
 *
 * This decouples Telegram configuration from the owner-supervisor agent,
 * enabling plugin-driven channel registration.
 */

import { createTelegramAdapter } from '@chat-adapter/telegram';
import type { ChannelPlugin, ChannelMessagingAdapter, IncomingMessage, MessagingOptions } from '@juragan/plugin-sdk';
import { definePluginEntry } from '@juragan/plugin-sdk';

export type { IncomingMessage, MessagingOptions };

function makeTelegramChannelPlugin(): ChannelPlugin {
  let messageHandler: ((msg: IncomingMessage) => void) | null = null;
  let adapterInstance: ReturnType<typeof createTelegramAdapter> | null = null;

  function getAdapter() {
    if (!adapterInstance) {
      adapterInstance = createTelegramAdapter({
        mode: 'auto',
        longPolling: {
          dropPendingUpdates: true,
        },
      });
    }
    return adapterInstance;
  }

  const messagingAdapter: ChannelMessagingAdapter = {
    async sendMessage(to: string, text: string, options?: MessagingOptions): Promise<void> {
      const adapter = getAdapter();
      // Telegram sendMessage: the Chat adapter uses chatId (numeric) not JID
      await adapter.sendMessage(to, text);
    },
    onMessage(handler: (message: IncomingMessage) => void): void {
      messageHandler = handler;
      const adapter = getAdapter();

      // Wire Telegram incoming message events → plugin handler
      // The @chat-adapter/telegram uses the Chat SDK which emits message events
      adapter.onNewMessage(async (message: { text?: string; senderId?: string; chatId?: string; id?: string; timestamp?: number }) => {
        if (!message.text || !message.chatId) return;
        const normalized: IncomingMessage = {
          id: message.id ?? `tg-${Date.now()}`,
          from: message.senderId ?? message.chatId,
          body: message.text,
          timestamp: message.timestamp ?? Date.now(),
          channel: 'telegram',
          meta: { chatId: message.chatId },
        };
        messageHandler?.(normalized);
      });
    },
  };

  return {
    id: 'telegram-channel',
    type: 'telegram',
    meta: {
      name: 'Telegram Channel',
      description: 'Telegram bot messaging via @chat-adapter/telegram',
    },
    adapters: {
      messaging: messagingAdapter,
      status: {
        async getStatus() {
          const adapter = getAdapter();
          const mode = (adapter as unknown as { runtimeMode?: string }).runtimeMode;
          if (mode === 'polling' || mode === 'webhook') return 'connected';
          return 'disconnected';
        },
        async probe() {
          const adapter = getAdapter();
          try {
            const start = Date.now();
            // Telegram getMe is a quick health check
            const me = await (adapter as unknown as { getMe?: () => Promise<unknown> }).getMe?.();
            return {
              ok: !!me,
              latencyMs: Date.now() - start,
            };
          } catch (err) {
            return {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        },
      },
      lifecycle: {
        async connect() {
          const adapter = getAdapter();
          // Initialize starts polling or prepares webhook
          await (adapter as unknown as { initialize?: () => Promise<void> }).initialize?.();
        },
        async disconnect() {
          const adapter = getAdapter();
          await (adapter as unknown as { stopPolling?: () => Promise<void> }).stopPolling?.();
        },
      },
    },
  };
}

export default definePluginEntry(
  {
    id: 'telegram-channel',
    name: 'Telegram Channel',
    version: '1.0.0',
    description: 'Telegram bot messaging via @chat-adapter/telegram',
  },
  (api) => {
    api.registerChannel(makeTelegramChannelPlugin());
  },
);
