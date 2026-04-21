import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type MemoryCommandDeps = { db: Db; tenantId: string };

export function createMemoryCommandTools({ db, tenantId }: MemoryCommandDeps) {
  const searchMemory = createTool({
    id: 'memory-search',
    description:
      'Cari di memory (catatan penting owner). Gunakan saat owner minta "/memory search [query]" atau ingin mencari catatan penting.',
    inputSchema: z.object({
      query: z.string().min(1).max(200).describe('Kata kunci pencarian'),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          id: z.number().int(),
          type: z.enum(['note', 'fact', 'preference', 'context']),
          content: z.string(),
          importance: z.number().int(),
          lastAccessedAt: z.number().int().nullable(),
          createdAt: z.number().int(),
        }),
      ),
      total: z.number().int(),
    }),
    execute: async ({ query, limit }) => {
      const effectiveLimit = limit ?? 10;
      const result = await db.execute({
        sql: `SELECT id, type, content, importance, last_accessed_at, created_at
              FROM memory
              WHERE tenant_id = ? AND content LIKE ?
              ORDER BY importance DESC, updated_at DESC
              LIMIT ?`,
        args: [tenantId, `%${query}%`, effectiveLimit],
      });

      // Update last_accessed_at for viewed memories
      const now = Date.now();
      for (const row of result.rows) {
        await db.execute({
          sql: 'UPDATE memory SET last_accessed_at = ? WHERE id = ?',
          args: [now, Number(row.id)],
        });
      }

      return {
        results: result.rows.map((r) => ({
          id: Number(r.id),
          type: r.type as 'note' | 'fact' | 'preference' | 'context',
          content: String(r.content),
          importance: Number(r.importance),
          lastAccessedAt: r.last_accessed_at != null ? Number(r.last_accessed_at) : null,
          createdAt: Number(r.created_at),
        })),
        total: result.rows.length,
      };
    },
  });

  const readMemory = createTool({
    id: 'memory-read',
    description:
      'Baca memory tertentu berdasarkan ID. Gunakan saat owner minta "/memory read [id]".',
    inputSchema: z.object({
      id: z.number().int().positive().describe('ID memory'),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      memory: z
        .object({
          id: z.number().int(),
          type: z.enum(['note', 'fact', 'preference', 'context']),
          content: z.string(),
          importance: z.number().int(),
          lastAccessedAt: z.number().int().nullable(),
          createdAt: z.number().int(),
          recallCount: z.number().int(),
        })
        .nullable(),
    }),
    execute: async ({ id }) => {
      const result = await db.execute({
        sql: `SELECT m.id, m.type, m.content, m.importance, m.last_accessed_at, m.created_at,
                     COALESCE(r.recall_count, 0) as recall_count
              FROM memory m
              LEFT JOIN memory_recalls r ON m.id = r.memory_id
              WHERE m.id = ? AND m.tenant_id = ?`,
        args: [id, tenantId],
      });

      if (result.rows.length === 0) {
        return { found: false, memory: null };
      }

      const row = result.rows[0];
      if (!row) {
        return { found: false, memory: null };
      }

      // Update last_accessed_at and recall count
      const now = Date.now();
      await db.execute({
        sql: 'UPDATE memory SET last_accessed_at = ? WHERE id = ?',
        args: [now, id],
      });

      // Upsert recall count
      await db.execute({
        sql: `INSERT INTO memory_recalls (memory_id, recall_count, last_recalled_at)
              VALUES (?, 1, ?)
              ON CONFLICT (memory_id) DO UPDATE SET
                recall_count = recall_count + 1,
                last_recalled_at = excluded.last_recalled_at`,
        args: [id, now],
      });

      return {
        found: true,
        memory: {
          id: Number(row.id),
          type: row.type as 'note' | 'fact' | 'preference' | 'context',
          content: String(row.content),
          importance: Number(row.importance),
          lastAccessedAt: row.last_accessed_at != null ? Number(row.last_accessed_at) : null,
          createdAt: Number(row.created_at),
          recallCount: Number(row.recall_count),
        },
      };
    },
  });

  const getMemoryStats = createTool({
    id: 'memory-stats',
    description:
      'Lihat statistik penggunaan memory. Gunakan saat owner minta "/memory stats".',
    inputSchema: z.object({}),
    outputSchema: z.object({
      totalMemories: z.number().int(),
      byType: z.object({
        note: z.number().int(),
        fact: z.number().int(),
        preference: z.number().int(),
        context: z.number().int(),
      }),
      topRecallMemories: z.array(
        z.object({
          id: z.number().int(),
          contentPreview: z.string(),
          recallCount: z.number().int(),
        }),
      ),
    }),
    execute: async () => {
      // Total and by type
      const totalResult = await db.execute({
        sql: `SELECT type, COUNT(*) as cnt FROM memory WHERE tenant_id = ? GROUP BY type`,
        args: [tenantId],
      });

      const byType = { note: 0, fact: 0, preference: 0, context: 0 };
      for (const row of totalResult.rows) {
        const type = String(row.type) as keyof typeof byType;
        if (type in byType) {
          byType[type] = Number(row.cnt);
        }
      }

      // Total count
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as cnt FROM memory WHERE tenant_id = ?`,
        args: [tenantId],
      });

      // Top recalled memories
      const recallResult = await db.execute({
        sql: `SELECT m.id, m.content, r.recall_count
              FROM memory m
              JOIN memory_recalls r ON m.id = r.memory_id
              WHERE m.tenant_id = ?
              ORDER BY r.recall_count DESC
              LIMIT 5`,
        args: [tenantId],
      });

      return {
        totalMemories: Number(countResult.rows[0]?.cnt ?? 0),
        byType,
        topRecallMemories: recallResult.rows.map((r) => ({
          id: Number(r.id),
          contentPreview: String(r.content).slice(0, 80),
          recallCount: Number(r.recall_count),
        })),
      };
    },
  });

  return { searchMemory, readMemory, getMemoryStats };
}
