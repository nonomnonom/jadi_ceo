import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type SearchContactsDeps = { db: Db; tenantId: string };

export function createSearchContactsTools({ db, tenantId }: SearchContactsDeps) {
  const searchContacts = createTool({
    id: 'search-contacts',
    description:
      'Cari kontak (customer, supplier, atau other) berdasarkan nama, phone, atau email. Cocok untuk lookup cepat.',
    inputSchema: z.object({
      query: z.string().min(1).max(100),
      type: z.enum(['customer', 'supplier', 'other', 'all']).default('all'),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    outputSchema: z.object({
      contacts: z.array(
        z.object({
          id: z.number().int(),
          type: z.enum(['customer', 'supplier', 'other']),
          name: z.string(),
          phone: z.string().nullable(),
          email: z.string().nullable(),
          createdAt: z.number().int(),
        }),
      ),
      total: z.number().int(),
    }),
    execute: async ({ query, type = 'all', limit = 20 }) => {
      const clauses = ['c.tenant_id = ?'];
      const args: (string | number)[] = [tenantId];

      if (type !== 'all') {
        clauses.push('c.type = ?');
        args.push(type);
      }

      if (query) {
        clauses.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
        const likeQuery = `%${query}%`;
        args.push(likeQuery, likeQuery, likeQuery);
      }

      args.push(limit);

      const result = await db.execute({
        sql: `SELECT c.id, c.type, c.name, c.phone, c.email, c.created_at
              FROM contacts c
              WHERE ${clauses.join(' AND ')}
              ORDER BY c.name ASC
              LIMIT ?`,
        args,
      });

      return {
        contacts: result.rows.map((r) => ({
          id: Number(r.id),
          type: String(r.type) as 'customer' | 'supplier' | 'other',
          name: String(r.name),
          phone: r.phone ? String(r.phone) : null,
          email: r.email ? String(r.email) : null,
          createdAt: Number(r.created_at),
        })),
        total: result.rows.length,
      };
    },
  });

  const getContactDetail = createTool({
    id: 'get-contact-detail',
    description: 'Lihat detail satu kontak berdasarkan ID.',
    inputSchema: z.object({
      id: z.number().int().positive(),
    }),
    outputSchema: z.object({
      id: z.number().int(),
      type: z.enum(['customer', 'supplier', 'other']),
      name: z.string(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
      address: z.string().nullable(),
      notes: z.string().nullable(),
      createdAt: z.number().int(),
      updatedAt: z.number().int(),
      orderCount: z.number().int().optional(),
      totalSpendIdr: z.number().int().optional(),
    }),
    execute: async ({ id }) => {
      const result = await db.execute({
        sql: 'SELECT * FROM contacts WHERE id = ? AND tenant_id = ?',
        args: [id, tenantId],
      });

      if (result.rows.length === 0) {
        throw new Error('Kontak tidak ditemukan');
      }

      const c = result.rows[0]!;

      // Get order stats for customers
      let orderCount = 0;
      let totalSpendIdr = 0;
      if (String(c.type) === 'customer') {
        const statsRes = await db.execute({
          sql: `SELECT COUNT(*) as cnt, COALESCE(SUM(total_idr), 0) as total
                FROM orders WHERE tenant_id = ? AND customer_phone = ? AND payment_status = 'paid'`,
          args: [tenantId, String(c.phone ?? '')],
        });
        if (statsRes.rows.length > 0) {
          orderCount = Number(statsRes.rows[0]!.cnt);
          totalSpendIdr = Number(statsRes.rows[0]!.total);
        }
      }

      return {
        id: Number(c.id),
        type: String(c.type) as 'customer' | 'supplier' | 'other',
        name: String(c.name),
        phone: c.phone ? String(c.phone) : null,
        email: c.email ? String(c.email) : null,
        address: c.address ? String(c.address) : null,
        notes: c.notes ? String(c.notes) : null,
        createdAt: Number(c.created_at),
        updatedAt: Number(c.updated_at),
        orderCount,
        totalSpendIdr,
      };
    },
  });

  return { searchContacts, getContactDetail };
}