import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type RequestCancelDeps = { db: Db; tenantId: string };

export function createRequestCancelTool({ db, tenantId }: RequestCancelDeps) {
  const requestCancel = createTool({
    id: 'request-cancel',
    description:
      'Minta pembatalan pesanan. Hanya bisa dibatalkan jika pesanan belum dibayar (status bukan paid).',
    inputSchema: z.object({
      orderId: z.number().int().positive(),
      reason: z.string().min(1).max(500).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      orderId: z.number().int(),
      cancelled: z.boolean(),
    }),
    execute: async ({ orderId, reason }) => {
      // Get order
      const orderResult = await db.execute({
        sql: `SELECT o.id, o.customer_phone, o.status, o.payment_status, p.name as product_name
              FROM orders o
              JOIN products p ON o.product_id = p.id
              WHERE o.id = ? AND o.tenant_id = ?`,
        args: [orderId, tenantId],
      });

      if (orderResult.rows.length === 0) {
        return { success: false, message: 'Order tidak ditemukan', orderId, cancelled: false };
      }

      const order = orderResult.rows[0]!;

      // Can only cancel if not already paid
      if (String(order.payment_status) === 'paid') {
        return {
          success: false,
          message: 'Pesanan sudah dibayar, tidak bisa dibatalkan. Hubungi owner untuk refund.',
          orderId,
          cancelled: false,
        };
      }

      if (String(order.status) === 'cancelled') {
        return {
          success: false,
          message: 'Pesanan sudah dibatalkan sebelumnya.',
          orderId,
          cancelled: false,
        };
      }

      const now = Date.now();
      const reasonText = reason ? `\nAlasan: ${reason}` : '';

      // Update order status to cancelled
      await db.execute({
        sql: "UPDATE orders SET status = 'cancelled', payment_status = 'cancelled', updated_at = ? WHERE id = ?",
        args: [now, orderId],
      });

      // Notify owner via console/log (owner will be notified through their Telegram)
      console.log(`[CANCELLATION] Order #${orderId} cancelled by customer ${order.customer_phone}. Reason: ${reason ?? 'none'}`);

      return {
        success: true,
        message: `Pesanan #${orderId} (${order.product_name}) berhasil dibatalkan.${reasonText}`,
        orderId,
        cancelled: true,
      };
    },
  });

  const getOrderTracking = createTool({
    id: 'get-order-tracking',
    description:
      'Lihat status dan detail pesanan. Untuk tracking pengiriman, pesanan harus sudah berstatus paid dan memiliki nomor resi.',
    inputSchema: z.object({
      orderId: z.number().int().positive(),
    }),
    outputSchema: z.object({
      orderId: z.number().int(),
      customerPhone: z.string(),
      productName: z.string(),
      qty: z.number().int(),
      totalIdr: z.number().int(),
      totalFormatted: z.string(),
      status: z.enum(['pending', 'approved', 'rejected', 'paid', 'cancelled']),
      paymentStatus: z.enum(['unpaid', 'paid', 'cancelled']),
      createdAt: z.number().int(),
      canCancel: z.boolean(),
      canApprove: z.boolean(),
      canReject: z.boolean(),
    }),
    execute: async ({ orderId }) => {
      const orderResult = await db.execute({
        sql: `SELECT o.id, o.customer_phone, o.qty, o.total_idr, o.status, o.payment_status, o.created_at,
                     p.name as product_name
              FROM orders o
              JOIN products p ON o.product_id = p.id
              WHERE o.id = ? AND o.tenant_id = ?`,
        args: [orderId, tenantId],
      });

      if (orderResult.rows.length === 0) {
        throw new Error('Order tidak ditemukan');
      }

      const order = orderResult.rows[0]!;
      const status = String(order.status) as 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';

      return {
        orderId: Number(order.id),
        customerPhone: String(order.customer_phone),
        productName: String(order.product_name),
        qty: Number(order.qty),
        totalIdr: Number(order.total_idr),
        totalFormatted: `Rp ${Number(order.total_idr).toLocaleString('id-ID')}`,
        status,
        paymentStatus: String(order.payment_status) as 'unpaid' | 'paid' | 'cancelled',
        createdAt: Number(order.created_at),
        canCancel: status === 'pending' || status === 'approved',
        canApprove: status === 'pending',
        canReject: status === 'pending',
      };
    },
  });

  return { requestCancel, getOrderTracking };
}