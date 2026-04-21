import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';
import { PakasirService, PakasirPaymentMethod } from '../../../services/pakasir.js';

export type OwnerPaymentDeps = { db: Db; tenantId: string };

export function createOwnerPaymentTools({ db, tenantId }: OwnerPaymentDeps) {
  const pakasir = new PakasirService({ db, tenantId });

  const generatePaymentLink = createTool({
    id: 'generate-payment-link',
    description:
      'Buat payment link Pakasir untuk pesanan. Link bisa dikirim ke customer via WhatsApp. Gunakan saat owner mau generate link pembayaran.',
    inputSchema: z.object({
      orderId: z.number().int().positive().describe('ID pesanan'),
      amount: z.number().int().positive().describe('Jumlah payment dalam IDR'),
      method: z.enum(['qris', 'cimb_niaga_va', 'bni_va', 'bri_va', 'mandiri_va']).default('qris'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      paymentRecord: z
        .object({
          orderId: z.string(),
          amountIdr: z.number(),
          totalPayment: z.number(),
          paymentMethod: z.string(),
          paymentNumber: z.string().nullable(),
          status: z.string(),
          expiredAt: z.number().nullable(),
        })
        .nullable(),
      message: z.string(),
    }),
    execute: async ({ orderId, amount, method }) => {
      const effectiveMethod = method ?? 'qris';
      try {
        const result = await pakasir.createTransaction({
          orderId: String(orderId),
          amount,
          method: effectiveMethod as PakasirPaymentMethod,
        });

        const payment = result.payment;
        const isVA = effectiveMethod !== 'qris';
        const paymentUrl = isVA
          ? `https://app.pakasir.com/pay/${payment.paymentMethod}/${amount}?order_id=${orderId}`
          : null;

        return {
          success: true,
          paymentRecord: {
            orderId: payment.orderId,
            amountIdr: payment.amountIdr,
            totalPayment: payment.totalPayment,
            paymentMethod: payment.paymentMethod,
            paymentNumber: payment.paymentNumber,
            status: payment.status,
            expiredAt: payment.expiredAt,
          },
          message: `✅ Payment ${effectiveMethod.toUpperCase()} dibuat untuk Order #${orderId}\nTotal: Rp ${payment.totalPayment.toLocaleString('id-ID')}\n${isVA && paymentUrl ? `Link: ${paymentUrl}` : ''}`,
        };
      } catch (err) {
        return {
          success: false,
          paymentRecord: null,
          message: `❌ Gagal membuat payment: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });

  const cancelPayment = createTool({
    id: 'cancel-payment',
    description:
      'Batalkan payment yang belum dibayar (status pending/expired). Gunakan saat owner mau batalkan invoice.',
    inputSchema: z.object({
      orderId: z.number().int().positive().describe('ID pesanan'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async ({ orderId }) => {
      // Check payment status first
      const payment = await pakasir.checkPaymentStatus(String(orderId));

      if (!payment) {
        return {
          success: false,
          message: `❌ Payment untuk Order #${orderId} tidak ditemukan.`,
        };
      }

      if (payment.status === 'completed') {
        return {
          success: false,
          message: `❌ Payment sudah completed, tidak bisa dibatalkan.`,
        };
      }

      if (payment.status === 'cancelled') {
        return {
          success: false,
          message: `❌ Payment sudah dibatalkan sebelumnya.`,
        };
      }

      try {
        await pakasir.cancelTransaction(String(orderId));
        return {
          success: true,
          message: `✅ Payment untuk Order #${orderId} berhasil dibatalkan.`,
        };
      } catch (err) {
        return {
          success: false,
          message: `❌ Gagal membatalkan payment: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });

  const simulatePayment = createTool({
    id: 'simulate-payment',
    description:
      'Simulasi payment completed (sandbox/testing). Gunakan untuk testing tanpa benar-benar bayar. Hanya untuk development!',
    inputSchema: z.object({
      orderId: z.number().int().positive().describe('ID pesanan'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async ({ orderId }) => {
      // Check payment exists
      const payment = await pakasir.checkPaymentStatus(String(orderId));

      if (!payment) {
        return {
          success: false,
          message: `❌ Payment untuk Order #${orderId} tidak ditemukan.`,
        };
      }

      if (payment.status === 'completed') {
        return {
          success: false,
          message: `❌ Payment sudah completed.`,
        };
      }

      try {
        await pakasir.simulatePayment(String(orderId));
        return {
          success: true,
          message: `✅ Payment simulation berhasil! Order #${orderId} ditandai sebagai paid.`,
        };
      } catch (err) {
        return {
          success: false,
          message: `❌ Gagal simulate payment: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });

  return { generatePaymentLink, cancelPayment, simulatePayment };
}
