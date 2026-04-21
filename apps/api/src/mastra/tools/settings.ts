import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../db/client.js';
import { getSetting, setSetting } from '../../db/settings.js';

export type SettingsToolDeps = { db: Db; tenantId: string };

export function createWhatsAppAutoReplySetting({ db, tenantId }: SettingsToolDeps) {
  const isAutoReplyEnabled = async (): Promise<boolean> => {
    const val = await getSetting(db, tenantId, 'whatsappAutoReply');
    if (val === null) return true; // default: enabled
    return val === 'true';
  };

  const setAutoReply = createTool({
    id: 'set-whatsapp-auto-reply',
    description:
      'Aktifkan atau nonaktifkan auto-reply WhatsApp. Ketika dinonaktifkan, pesan customer tidak akan dijawab secara otomatis — owner akan diberi tahu via Telegram.',
    inputSchema: z.object({
      enabled: z.boolean(),
    }),
    outputSchema: z.object({ ok: z.boolean(), enabled: z.boolean() }),
    execute: async ({ enabled }) => {
      await setSetting(db, tenantId, 'whatsappAutoReply', String(enabled));
      return { ok: true, enabled };
    },
  });

  const getAutoReplyStatus = createTool({
    id: 'get-whatsapp-auto-reply-status',
    description: 'Cek apakah auto-reply WhatsApp sedang aktif atau nonaktif.',
    inputSchema: z.object({}),
    outputSchema: z.object({ enabled: z.boolean() }),
    execute: async () => {
      const enabled = await isAutoReplyEnabled();
      return { enabled };
    },
  });

  return { isAutoReplyEnabled, setAutoReply, getAutoReplyStatus };
}