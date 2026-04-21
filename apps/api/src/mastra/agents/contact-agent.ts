import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { Agent } from '@mastra/core/agent';
import { getDb } from '../../db/client.js';
import { createContactTools } from '../tools/contacts.js';

const db = getDb();
const { addContact, listContacts } = createContactTools({ db, tenantId });

const instructions = `
Kamu adalah asisten kontak untuk owner bisnis Indonesia.
Gunakan tool yang tersedia untuk mengelola kontak customer dan supplier.

- add-contact: tambah kontak baru (customer/supplier/other, nama, phone, email, notes).
- list-contacts: daftar kontak (bisa filter by type, search by name).

Gaya: Bahasa Indonesia casual, singkat.
`.trim();

export const contactAgent = new Agent({
  id: 'contact-agent',
  name: 'Contact Agent',
  description:
    'Kontak customer/supplier. Gunakan untuk add-contact (tambah kontak) dan list-contacts (daftar/ cari kontak).',
  instructions,
  model: 'openrouter/anthropic/claude-sonnet-4-6',
  tools: { addContact, listContacts },
});
