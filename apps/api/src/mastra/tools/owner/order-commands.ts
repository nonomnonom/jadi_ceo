import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';
import { getWhatsAppManager, phoneToJid } from '../../../channels/whatsapp-manager.js';

export type OrderCommandDeps = { db: Db; tenantId: string };

export function createOrderCommandTools({ db, tenantId }: OrderCommandDeps) {
  const listOrders = createTool({
    id: 'list-orders',
    description:
      'Lihat semua pesanan dari customer WhatsApp. Gunakan saat owner minta "/order list" atau ingin melihat daftar order.',
    inputSchema: z.object({
      status: z
        .enum(['pending', 'approved', 'rejected', 'paid', 'cancelled', 'all'])
        .default('pending'),
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
    }),
    execute: async ({ status, limit }) => {
      const clauses: string[] = ['o.tenant_id = ?'];
      const args: (string | number)[] = [tenantId];

      if (status && status !== 'all') {
        clauses.push('o.status = ?');
        args.push(status);
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
      };
    },
  });

  const approveOrder = createTool({
    id: 'approve-order',
    description:
      'Setuju/pprove pesanan customer. Kirim notifikasi WhatsApp ke customer. Gunakan saat owner bilang "/order approve [id]".',
    inputSchema: z.object({
      orderId: z.number().int().positive(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      orderId: z.number().int(),
      customerNotified: z.boolean(),
    }),
    execute: async ({ orderId }) => {
      // Get order details
      const orderResult = await db.execute({
        sql: `SELECT o.id, o.customer_phone, o.total_idr, o.status, p.name as product_name
              FROM orders o
              JOIN products p ON o.product_id = p.id
              WHERE o.id = ? AND o.tenant_id = ?`,
        args: [orderId, tenantId],
      });

      if (orderResult.rows.length === 0) {
        return { success: false, message: 'Order tidak ditemukan', orderId, customerNotified: false };
      }

      const order = orderResult.rows[0];
      if (!order) {
        return { success: false, message: 'Order tidak ditemukan', orderId, customerNotified: false };
      }

      if (String(order.status) !== 'pending') {
        return {
          success: false,
          message: `Order sudah berstatus "${order.status}", tidak bisa di-approve`,
          orderId,
          customerNotified: false,
        };
      }

      const now = Date.now();
      await db.execute({
        sql: "UPDATE orders SET status = 'approved', updated_at = ? WHERE id = ?",
        args: [now, orderId],
      });

      // Notify customer via WhatsApp
      let customerNotified = false;
      const manager = getWhatsAppManager();
      const customerPhone = String(order.customer_phone);

      if (manager.getStatus().connected) {
        try {
          const jid = phoneToJid(customerPhone);
          const totalFormatted = `Rp ${Number(order.total_idr).toLocaleString('id-ID')}`;
          await manager.sendMessageToJid(jid, {
            text: `✅ Pesanan kamu sudah DIKONFIRMASI!\n\nOrder ID: #${orderId}\nProduk: ${order.product_name}\nTotal: ${totalFormatted}\n\nPesanan akan segera diproses. Terima kasih!`,
          });
          customerNotified = true;
        } catch (err) {
          console.error('Failed to notify customer:', err);
        }
      }

      return {
        success: true,
        message: `Order #${orderId} di-approve. Customer${customerNotified ? '' : ' TIDAK'} berhasil dikirim notifikasi WA.`,
        orderId,
        customerNotified,
      };
    },
  });

  const rejectOrder = createTool({
    id: 'reject-order',
    description:
      'Tolak pesanan customer. Kirim notifikasi WhatsApp ke customer. Gunakan saat owner bilang "/order reject [id]" atau "/order tolak [id]".',
    inputSchema: z.object({
      orderId: z.number().int().positive(),
      reason: z.string().max(200).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      orderId: z.number().int(),
      customerNotified: z.boolean(),
    }),
    execute: async ({ orderId, reason }) => {
      // Get order details
      const orderResult = await db.execute({
        sql: `SELECT o.id, o.customer_phone, o.status, p.name as product_name
              FROM orders o
              JOIN products p ON o.product_id = p.id
              WHERE o.id = ? AND o.tenant_id = ?`,
        args: [orderId, tenantId],
      });

      if (orderResult.rows.length === 0) {
        return { success: false, message: 'Order tidak ditemukan', orderId, customerNotified: false };
      }

      const order = orderResult.rows[0];
      if (!order) {
        return { success: false, message: 'Order tidak ditemukan', orderId, customerNotified: false };
      }

      if (String(order.status) !== 'pending') {
        return {
          success: false,
          message: `Order sudah berstatus "${order.status}", tidak bisa di-reject`,
          orderId,
          customerNotified: false,
        };
      }

      const now = Date.now();
      await db.execute({
        sql: "UPDATE orders SET status = 'rejected', updated_at = ? WHERE id = ?",
        args: [now, orderId],
      });

      // Notify customer via WhatsApp
      let customerNotified = false;
      const manager = getWhatsAppManager();
      const customerPhone = String(order.customer_phone);

      if (manager.getStatus().connected) {
        try {
          const jid = phoneToJid(customerPhone);
          const reasonText = reason ? `\nAlasan: ${reason}` : '';
          await manager.sendMessageToJid(jid, {
            text: `❌ Pesanan kamu DITOLAK.\n\nOrder ID: #${orderId}\nProduk: ${order.product_name}${reasonText}\n\nMohon maaf atas ketidaknyamanannya.`,
          });
          customerNotified = true;
        } catch (err) {
          console.error('Failed to notify customer:', err);
        }
      }

      return {
        success: true,
        message: `Order #${orderId} di-reject. Customer${customerNotified ? '' : ' TIDAK'} berhasil dikirim notifikasi WA.`,
        orderId,
        customerNotified,
      };
    },
  });

  return { listOrders, approveOrder, rejectOrder };
}
