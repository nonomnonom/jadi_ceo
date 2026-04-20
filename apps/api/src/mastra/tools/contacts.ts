import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../db/client.js';

export type ContactToolDeps = { db: Db; tenantId: string };

const ContactTypeSchema = z.enum(['customer', 'supplier', 'other']);

const ContactSchema = z.object({
  id: z.number().int(),
  type: ContactTypeSchema,
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
});

export function createContactTools({ db, tenantId }: ContactToolDeps) {
  const addContact = createTool({
    id: 'add-contact',
    description:
      'Simpan kontak: customer, supplier, atau lainnya. Phone format bebas (contoh: "+62 812-3456-7890" atau "08123456789"). Gunakan saat owner bilang "tambah customer", "supplier baru X", "catet kontaknya".',
    inputSchema: z.object({
      type: ContactTypeSchema,
      name: z.string().min(1).max(200),
      phone: z.string().min(1).max(40).optional(),
      email: z.string().email().max(200).optional(),
      notes: z.string().max(500).optional(),
    }),
    outputSchema: ContactSchema,
    execute: async ({ type, name, phone, email, notes }) => {
      const now = Date.now();
      const result = await db.execute({
        sql: 'INSERT INTO contacts (tenant_id, type, name, phone, email, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
        args: [tenantId, type, name, phone ?? null, email ?? null, notes ?? null, now, now],
      });
      const row = result.rows[0];
      if (!row) throw new Error('Gagal menyimpan kontak');
      return {
        id: Number(row.id),
        type,
        name,
        phone: phone ?? null,
        email: email ?? null,
        notes: notes ?? null,
      };
    },
  });

  const listContacts = createTool({
    id: 'list-contacts',
    description:
      'Cari/lihat kontak. Bisa filter type (customer/supplier/other) dan search nama (substring, case-insensitive). Gunakan saat owner tanya "customer X kontaknya apa", "supplier siapa aja", "siapa yang beli".',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(20),
      type: ContactTypeSchema.optional(),
      search: z.string().min(1).max(200).optional(),
    }),
    outputSchema: z.object({ contacts: z.array(ContactSchema) }),
    execute: async ({ limit, type, search }) => {
      const lim = limit ?? 20;
      const clauses: string[] = ['tenant_id = ?'];
      const args: (string | number)[] = [tenantId];
      if (type) {
        clauses.push('type = ?');
        args.push(type);
      }
      if (search) {
        clauses.push('LOWER(name) LIKE ?');
        args.push(`%${search.toLowerCase()}%`);
      }
      args.push(lim);
      const sql = `SELECT id, type, name, phone, email, notes FROM contacts WHERE ${clauses.join(' AND ')} ORDER BY name ASC LIMIT ?`;
      const result = await db.execute({ sql, args });
      return {
        contacts: result.rows.map((r) => ({
          id: Number(r.id),
          type: String(r.type) as z.infer<typeof ContactTypeSchema>,
          name: String(r.name),
          phone: r.phone == null ? null : String(r.phone),
          email: r.email == null ? null : String(r.email),
          notes: r.notes == null ? null : String(r.notes),
        })),
      };
    },
  });

  return { addContact, listContacts };
}
