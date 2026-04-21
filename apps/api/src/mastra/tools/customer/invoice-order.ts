import { createTool } from '@mastra/core/tools';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';
import { getSetting } from '../../../db/settings.js';
import { RajaongkirService } from '../../../services/rajaongkir.js';
import { PakasirService } from '../../../services/pakasir.js';

export type InvoiceOrderDeps = { db: Db; tenantId: string };

export function createInvoiceOrderTool({ db, tenantId }: InvoiceOrderDeps) {
  const invoiceOrder = createTool({
    id: 'invoice-order',
    description:
      'Buat pesanan lengkap dengan produk, ongkir, dan pembayaran. Cocok untuk flow lengkap dari inquiry sampai payment.',
    inputSchema: z.object({
      productId: z.number().int().positive(),
      qty: z.number().int().min(1),
      customerPhone: z.string().min(6),
      originCityId: z.string(),
      destinationCityId: z.string(),
      courier: z.string().default('jne'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      orderId: z.number().int().nullable(),
      status: z.enum(['pending', 'approved', 'rejected', 'paid', 'cancelled']).nullable(),
      needsApproval: z.boolean(),
      shippingCost: z.number().int().nullable(),
      totalAmount: z.number().int().nullable(),
      paymentRequest: z.object({
        method: z.string(),
        qrImage: z.string().nullable(),
        paymentNumber: z.string().nullable(),
        totalPayment: z.number().int(),
        expiredAt: z.number().int().nullable(),
      }).nullable(),
      message: z.string(),
    }),
    execute: async ({ productId, qty, customerPhone, originCityId, destinationCityId, courier }) => {
      // 1. Get product and validate stock
      const productResult = await db.execute({
        sql: 'SELECT id, name, price_idr, stock_qty FROM products WHERE id = ? AND tenant_id = ?',
        args: [productId, tenantId],
      });

      if (productResult.rows.length === 0) {
        throw new Error('Produk tidak ditemukan');
      }

      const product = productResult.rows[0]!;
      const stockQty = Number(product.stock_qty);
      const priceIdr = Number(product.price_idr);

      if (stockQty < qty) {
        throw new Error(`Stok tidak cukup. Tersedia: ${stockQty}`);
      }

      const productTotal = priceIdr * qty;

      // 2. Calculate shipping cost
      const rajaongkir = new RajaongkirService({ db, tenantId });
      let shippingCost = 0;
      try {
        const shippingCosts = await rajaongkir.calculateShipping({
          origin: originCityId,
          destination: destinationCityId,
          weight: qty * 1000, // 1kg per item
          courier,
        });
        if (shippingCosts.length > 0) {
          // Pick the cheapest option
          shippingCosts.sort((a, b) => a.cost - b.cost);
          shippingCost = shippingCosts[0]!.cost;
        }
      } catch (err) {
        console.warn('Failed to calculate shipping:', err);
        // Continue without shipping cost if Rajaongkir fails
      }

      const totalAmount = productTotal + shippingCost;

      // 3. Check auto_process setting
      const autoProcess = await getSetting(db, tenantId, 'autoProcessOrders' as any);
      const shouldAutoApprove = autoProcess === 'true';

      // 4. Create order in database
      const now = Date.now();
      const orderResult = await db.execute({
        sql: `INSERT INTO orders (tenant_id, customer_phone, product_id, qty, total_idr, status, payment_status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [
          tenantId,
          customerPhone,
          productId,
          qty,
          totalAmount,
          shouldAutoApprove ? 'approved' : 'pending',
          'unpaid',
          now,
          now,
        ],
      });

      const orderRow = orderResult.rows[0]!;
      const orderId = Number(orderRow.id);

      // 5. If auto-approved, request payment
      let paymentRequest = null;
      if (shouldAutoApprove) {
        try {
          const pakasir = new PakasirService({ db, tenantId });
          const paymentResult = await pakasir.createTransaction({
            orderId: String(orderId),
            amount: totalAmount,
            method: 'qris',
          });

          // Generate QR code if QRIS
          let qrImage: string | null = null;
          if (paymentResult.payment.paymentNumber) {
            qrImage = await QRCode.toDataURL(paymentResult.payment.paymentNumber, {
              width: 256,
              margin: 2,
            });
          }

          paymentRequest = {
            method: paymentResult.payment.paymentMethod,
            qrImage,
            paymentNumber: paymentResult.payment.paymentNumber,
            totalPayment: paymentResult.payment.totalPayment,
            expiredAt: paymentResult.payment.expiredAt,
          };
        } catch (err) {
          console.error('Failed to create payment:', err);
          // Order is created but payment failed - owner needs to handle manually
        }
      }

      return {
        success: true,
        orderId,
        status: (shouldAutoApprove ? 'approved' : 'pending') as 'pending' | 'approved',
        needsApproval: !shouldAutoApprove,
        shippingCost: shippingCost || null,
        totalAmount,
        paymentRequest,
        message: shouldAutoApprove
          ? `Order #${orderId} di-approve dan payment request sudah dibuat.`
          : `Order #${orderId} dibuat dan menunggu approval.`,
      };
    },
  });

  return { invoiceOrder };
}
