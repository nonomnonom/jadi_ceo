import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../db/client.js';

export type NoteToolDeps = { db: Db; tenantId: string };

const NoteSchema = z.object({
  id: z.number().int(),
  content: z.string(),
  category: z.string().nullable(),
  createdAt: z.number().int(),
});

export function createNoteTools({ db, tenantId }: NoteToolDeps) {
  const addNote = createTool({
    id: 'add-note',
    description:
      'Simpan catatan singkat milik owner (misal: pesan supplier, ide produk, permintaan customer). Berikan category jika ingin mengelompokkan (contoh: "supplier", "ide", "customer"). Gunakan ini setiap owner bilang "catet", "ingetin aku soal X", atau memberi info yang perlu disimpan.',
    inputSchema: z.object({
      content: z.string().min(1).max(2000),
      category: z.string().min(1).max(40).optional(),
    }),
    outputSchema: NoteSchema,
    execute: async ({ content, category }) => {
      const createdAt = Date.now();
      const result = await db.execute({
        sql: 'INSERT INTO notes (tenant_id, content, category, created_at) VALUES (?, ?, ?, ?) RETURNING id',
        args: [tenantId, content, category ?? null, createdAt],
      });
      const row = result.rows[0];
      if (!row) throw new Error('Gagal menyimpan catatan');
      return {
        id: Number(row.id),
        content,
        category: category ?? null,
        createdAt,
      };
    },
  });

  const listNotes = createTool({
    id: 'list-notes',
    description:
      'Ambil catatan terbaru milik owner, diurutkan dari yang paling baru. Default 10. Bisa filter by category. Gunakan saat owner tanya "apa catatanku", "tadi aku catet apa", atau minta ringkasan catatan.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(10),
      category: z.string().min(1).max(40).optional(),
    }),
    outputSchema: z.object({ notes: z.array(NoteSchema) }),
    execute: async ({ limit, category }) => {
      const lim = limit ?? 10;
      const result = category
        ? await db.execute({
            sql: 'SELECT id, content, category, created_at FROM notes WHERE tenant_id = ? AND category = ? ORDER BY created_at DESC LIMIT ?',
            args: [tenantId, category, lim],
          })
        : await db.execute({
            sql: 'SELECT id, content, category, created_at FROM notes WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?',
            args: [tenantId, lim],
          });
      return {
        notes: result.rows.map((r) => ({
          id: Number(r.id),
          content: String(r.content),
          category: r.category == null ? null : String(r.category),
          createdAt: Number(r.created_at),
        })),
      };
    },
  });

  return { addNote, listNotes };
}
