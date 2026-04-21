import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type ThreadCommandDeps = { db: Db; tenantId: string };

export function createThreadCommandTools({ db, tenantId }: ThreadCommandDeps) {
  const setThread = createTool({
    id: 'set-thread',
    description:
      'Set topik percakapan saat ini. Gunakan saat owner mau membahas topik tertentu (mis: "/thread invoice bermasalah" atau "/thread supplier X"). Ini membantu konteks agar fokus.',
    inputSchema: z.object({
      topic: z.string().min(1).max(200),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      thread: z.string(),
      message: z.string(),
    }),
    execute: async ({ topic }) => {
      const now = Date.now();
      await db.execute({
        sql: `INSERT INTO settings (tenant_id, key, value, updated_at)
              VALUES (?, 'active_thread', ?, ?)
              ON CONFLICT (tenant_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        args: [tenantId, topic.trim(), now],
      });
      return {
        success: true,
        thread: topic.trim(),
        message: `Thread aktif: "${topic.trim()}". Semua pesan selanjutnya akan dikaitkan dengan topik ini.`,
      };
    },
  });

  const getThread = createTool({
    id: 'get-thread',
    description: 'Lihat thread/topik percakapan yang sedang aktif.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      active: z.boolean(),
      thread: z.string().nullable(),
    }),
    execute: async () => {
      const result = await db.execute({
        sql: "SELECT value FROM settings WHERE tenant_id = ? AND key = 'active_thread'",
        args: [tenantId],
      });
      if (result.rows.length === 0) {
        return { active: false, thread: null };
      }
      return { active: true, thread: String(result.rows[0]!.value) };
    },
  });

  const clearThread = createTool({
    id: 'clear-thread',
    description: 'Hapus thread aktif. Gunakan saat owner mau reset konteks ke umum.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async () => {
      await db.execute({
        sql: "DELETE FROM settings WHERE tenant_id = ? AND key = 'active_thread'",
        args: [tenantId],
      });
      return {
        success: true,
        message: 'Thread aktif dihapus. Konteks kembali ke umum.',
      };
    },
  });

  return { setThread, getThread, clearThread };
}