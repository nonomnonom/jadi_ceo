import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { Agent } from '@mastra/core/agent';
import { getDb } from '../../db/client.js';
import { createNoteTools } from '../tools/notes.js';

const db = getDb();
const { addNote, listNotes } = createNoteTools({ db, tenantId });

const instructions = `
Kamu adalah asisten catatan untuk owner bisnis Indonesia.
Gunakan tool yang tersedia untuk menyimpan dan melihat catatan.

- add-note: simpan catatan baru. Panggil kapanpun owner memberi info untuk dicatat.
- list-notes: lihat daftar catatan yang sudah ada.

Gaya: Bahasa Indonesia casual, singkat.
`.trim();

export const noteAgent = new Agent({
  id: 'note-agent',
  name: 'Note Agent',
  description:
    'Catatan pendek, ide, daftar. Gunakan untuk add-note (simpan catatan baru) dan list-notes (lihat catatan yang ada).',
  instructions,
  model: 'openrouter/anthropic/claude-sonnet-4-6',
  tools: { addNote, listNotes },
});
