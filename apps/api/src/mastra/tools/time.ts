import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export const getCurrentTime = createTool({
  id: 'get-current-time',
  description:
    'Ambil waktu sekarang di zona Asia/Jakarta (WIB). Panggil ini SEBELUM set-reminder atau saat butuh acuan "sekarang", "hari ini", "besok". Jangan pernah menebak waktu berdasarkan pengetahuan internal.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    epochMs: z.number().int(),
    isoUtc: z.string(),
    isoJakarta: z.string(),
    humanJakarta: z.string(),
  }),
  execute: async () => {
    const now = new Date();
    const epochMs = now.getTime();
    const jakarta = new Date(epochMs + JAKARTA_OFFSET_MS);
    const isoJakarta = `${jakarta.toISOString().slice(0, 19)}+07:00`;
    const humanJakarta = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);
    return {
      epochMs,
      isoUtc: now.toISOString(),
      isoJakarta,
      humanJakarta,
    };
  },
});
