import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../db/client.js';

export type ReminderToolDeps = { db: Db; tenantId: string };

const ReminderSchema = z.object({
  id: z.number().int(),
  content: z.string(),
  remindAt: z.number().int(),
  done: z.boolean(),
  createdAt: z.number().int(),
});

export function createReminderTools({ db, tenantId }: ReminderToolDeps) {
  const setReminder = createTool({
    id: 'set-reminder',
    description:
      'Buat pengingat untuk owner. Konversi waktu natural language ("besok jam 9", "minggu depan") ke ISO-8601 zona Asia/Jakarta — panggil get-current-time dulu kalau butuh acuan sekarang. Pengingat TIDAK otomatis mengirim notifikasi di versi ini; hanya disimpan agar bisa dilihat lewat list-reminders.',
    inputSchema: z.object({
      content: z.string().min(1).max(500),
      remindAt: z
        .string()
        .datetime({ offset: true })
        .describe(
          'Waktu pengingat dalam ISO-8601 dengan offset. Contoh: "2026-04-22T09:00:00+07:00".',
        ),
    }),
    outputSchema: ReminderSchema,
    execute: async ({ content, remindAt }) => {
      const remindAtMs = new Date(remindAt).getTime();
      const createdAt = Date.now();
      const result = await db.execute({
        sql: 'INSERT INTO reminders (tenant_id, content, remind_at, done, created_at) VALUES (?, ?, ?, 0, ?) RETURNING id',
        args: [tenantId, content, remindAtMs, createdAt],
      });
      const row = result.rows[0];
      if (!row) throw new Error('Gagal membuat pengingat');
      return {
        id: Number(row.id),
        content,
        remindAt: remindAtMs,
        done: false,
        createdAt,
      };
    },
  });

  const listReminders = createTool({
    id: 'list-reminders',
    description:
      'Lihat pengingat yang belum selesai, diurutkan dari yang paling dekat waktunya. Gunakan saat owner tanya "pengingatku apa aja" atau "agenda hari ini".',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(10),
    }),
    outputSchema: z.object({ reminders: z.array(ReminderSchema) }),
    execute: async ({ limit }) => {
      const lim = limit ?? 10;
      const result = await db.execute({
        sql: 'SELECT id, content, remind_at, done, created_at FROM reminders WHERE tenant_id = ? AND done = 0 ORDER BY remind_at ASC LIMIT ?',
        args: [tenantId, lim],
      });
      return {
        reminders: result.rows.map((r) => ({
          id: Number(r.id),
          content: String(r.content),
          remindAt: Number(r.remind_at),
          done: Number(r.done) === 1,
          createdAt: Number(r.created_at),
        })),
      };
    },
  });

  return { setReminder, listReminders };
}
