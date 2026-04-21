import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type CustomerCommandDeps = { db: Db; tenantId: string };

export function createCustomerCommandTools({ db, tenantId }: CustomerCommandDeps) {
  const listCustomerOrders = createTool({
    id: 'list-customer-orders',
    description:
      'Lihat semua pesanan dari customer WhatsApp tertentu. Gunakan saat owner minta "/customer orders" atau ingin melihat riwayat order seorang customer.',
    inputSchema: z.object({
      phone: z.string().optional().describe('Nomor HP customer (format: +62812xxx atau 0812xxx)'),
      limit: z.number().int().min(1).max(100).default(20),
    }),
    outputSchema: z.object({
      orders: z.array(
        z.object({
          id: z.number().int(),
          customerPhone: z.string(),
          productName: z.string(),
          qty: z.number().int(),
          totalIdr: z.number().int(),
          totalFormatted: z.string(),
          status: z.enum(['pending', 'approved', 'rejected', 'paid', 'cancelled']),
          paymentStatus: z.enum(['unpaid', 'paid', 'cancelled']),
          createdAt: z.number().int(),
        }),
      ),
      summary: z.object({
        totalOrders: z.number().int(),
        pendingCount: z.number().int(),
        paidCount: z.number().int(),
      }),
    }),
    execute: async ({ phone, limit }) => {
      const clauses: string[] = ['o.tenant_id = ?'];
      const args: (string | number)[] = [tenantId];

      if (phone) {
        // Normalize phone number
        let normalizedPhone = phone.replace(/^\+/, '').replace(/^0/, '62');
        clauses.push('o.customer_phone LIKE ?');
        args.push(`%${normalizedPhone}%`);
      }

      args.push(limit ?? 20);
      const sql = `
        SELECT o.id, o.customer_phone, p.name as product_name, o.qty, o.total_idr,
               o.status, o.payment_status, o.created_at
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE ${clauses.join(' AND ')}
        ORDER BY o.created_at DESC
        LIMIT ?`;

      const result = await db.execute({ sql, args });

      // Get summary counts
      const summaryClauses: string[] = ['tenant_id = ?'];
      const summaryArgs: (string | number)[] = [tenantId];
      if (phone) {
        summaryClauses.push('customer_phone LIKE ?');
        summaryArgs.push(`%${phone.replace(/^\+/, '').replace(/^0/, '62')}%`);
      }

      const summaryResult = await db.execute({
        sql: `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid
              FROM orders WHERE ${summaryClauses.join(' AND ')}`,
        args: summaryArgs,
      });

      const summaryRow = summaryResult.rows[0];

      return {
        orders: result.rows.map((r) => ({
          id: Number(r.id),
          customerPhone: String(r.customer_phone),
          productName: String(r.product_name),
          qty: Number(r.qty),
          totalIdr: Number(r.total_idr),
          totalFormatted: `Rp ${Number(r.total_idr).toLocaleString('id-ID')}`,
          status: r.status as 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled',
          paymentStatus: r.payment_status as 'unpaid' | 'paid' | 'cancelled',
          createdAt: Number(r.created_at),
        })),
        summary: {
          totalOrders: Number(summaryRow?.total ?? 0),
          pendingCount: Number(summaryRow?.pending ?? 0),
          paidCount: Number(summaryRow?.paid ?? 0),
        },
      };
    },
  });

  const viewCustomerConversation = createTool({
    id: 'view-customer-conversation',
    description:
      'Lihat riwayat percakapan customer WhatsApp. Gunakan saat owner minta "/customer view [phone]" atau ingin melihat chat customer.',
    inputSchema: z.object({
      phone: z.string().describe('Nomor HP customer (format: +62812xxx atau 0812xxx)'),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    outputSchema: z.object({
      phone: z.string(),
      conversations: z.array(
        z.object({
          id: z.number().int(),
          direction: z.enum(['inbound', 'outbound']),
          message: z.string(),
          createdAt: z.number().int(),
          createdAtFormatted: z.string(),
        }),
      ),
      stats: z.object({
        totalMessages: z.number().int(),
        inboundCount: z.number().int(),
        outboundCount: z.number().int(),
      }),
    }),
    execute: async ({ phone, limit }) => {
      // Normalize phone number
      let normalizedPhone = phone.replace(/^\+/, '').replace(/^0/, '62');
      if (!normalizedPhone.startsWith('62')) {
        normalizedPhone = '62' + normalizedPhone;
      }

      const result = await db.execute({
        sql: `SELECT id, direction, message, created_at
              FROM conversations
              WHERE tenant_id = ? AND channel = 'whatsapp' AND customer_phone LIKE ?
              ORDER BY created_at DESC
              LIMIT ?`,
        args: [tenantId, `%${normalizedPhone}%`, limit ?? 50],
      });

      const conversations = result.rows.map((r) => {
        const ts = Number(r.created_at);
        const date = new Date(ts);
        return {
          id: Number(r.id),
          direction: r.direction as 'inbound' | 'outbound',
          message: String(r.message).slice(0, 500),
          createdAt: ts,
          createdAtFormatted: date.toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
      });

      // Get stats
      const statsResult = await db.execute({
        sql: `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
                SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound
              FROM conversations
              WHERE tenant_id = ? AND channel = 'whatsapp' AND customer_phone LIKE ?`,
        args: [tenantId, `%${normalizedPhone}%`],
      });

      const statsRow = statsResult.rows[0];

      return {
        phone: normalizedPhone,
        conversations,
        stats: {
          totalMessages: Number(statsRow?.total ?? 0),
          inboundCount: Number(statsRow?.inbound ?? 0),
          outboundCount: Number(statsRow?.outbound ?? 0),
        },
      };
    },
  });

  const getCustomerAnalytics = createTool({
    id: 'get-customer-analytics',
    description:
      'Lihat statistik interaksi customer WhatsApp secara keseluruhan. Gunakan saat owner minta "/customer analytics" atau ingin melihat statistik customer.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      totalCustomers: z.number().int(),
      totalOrders: z.number().int(),
      totalRevenue: z.number().int(),
      revenueFormatted: z.string(),
      ordersByStatus: z.object({
        pending: z.number().int(),
        approved: z.number().int(),
        rejected: z.number().int(),
        paid: z.number().int(),
        cancelled: z.number().int(),
      }),
      topCustomers: z.array(
        z.object({
          phone: z.string(),
          orderCount: z.number().int(),
          totalSpent: z.number().int(),
        }),
      ),
    }),
    execute: async () => {
      // Get total unique customers
      const customerResult = await db.execute({
        sql: `SELECT COUNT(DISTINCT customer_phone) as cnt FROM orders WHERE tenant_id = ?`,
        args: [tenantId],
      });

      // Get total orders and revenue
      const orderStatsResult = await db.execute({
        sql: `SELECT COUNT(*) as total, COALESCE(SUM(total_idr), 0) as revenue FROM orders WHERE tenant_id = ?`,
        args: [tenantId],
      });

      // Get orders by status
      const statusResult = await db.execute({
        sql: `SELECT status, COUNT(*) as cnt FROM orders WHERE tenant_id = ? GROUP BY status`,
        args: [tenantId],
      });

      const ordersByStatus = {
        pending: 0,
        approved: 0,
        rejected: 0,
        paid: 0,
        cancelled: 0,
      };
      for (const row of statusResult.rows) {
        const status = String(row.status) as keyof typeof ordersByStatus;
        if (status in ordersByStatus) {
          ordersByStatus[status] = Number(row.cnt);
        }
      }

      // Get top customers
      const topCustomerResult = await db.execute({
        sql: `SELECT customer_phone, COUNT(*) as order_count, SUM(total_idr) as total_spent
              FROM orders WHERE tenant_id = ?
              GROUP BY customer_phone
              ORDER BY total_spent DESC
              LIMIT 5`,
        args: [tenantId],
      });

      return {
        totalCustomers: Number(customerResult.rows[0]?.cnt ?? 0),
        totalOrders: Number(orderStatsResult.rows[0]?.total ?? 0),
        totalRevenue: Number(orderStatsResult.rows[0]?.revenue ?? 0),
        revenueFormatted: `Rp ${Number(orderStatsResult.rows[0]?.revenue ?? 0).toLocaleString('id-ID')}`,
        ordersByStatus,
        topCustomers: topCustomerResult.rows.map((r) => ({
          phone: String(r.customer_phone),
          orderCount: Number(r.order_count),
          totalSpent: Number(r.total_spent),
        })),
      };
    },
  });

  return { listCustomerOrders, viewCustomerConversation, getCustomerAnalytics };
}
