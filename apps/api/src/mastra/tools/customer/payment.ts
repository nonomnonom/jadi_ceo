import { createTool } from '@mastra/core/tools';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';
import { PakasirService } from '../../../services/pakasir.js';

export type CustomerPaymentToolDeps = { db: Db; tenantId: string };

export function createRequestPaymentTool({ db, tenantId }: CustomerPaymentToolDeps) {
  const requestPayment = createTool({
    id: 'request-payment',
    description:
      'Minta pembayaran untuk pesanan via QRIS atau Virtual Account. Gunakan saat customer mau bayar.',
    inputSchema: z.object({
      orderId: z.number().int().positive(),
      amountIdr: z.number().int().positive(),
      paymentMethod: z
        .enum(['qris', 'cimb_niaga_va', 'bni_va', 'bri_va', 'mandiri_va'])
        .default('qris'),
    }),
    outputSchema: z.object({
      ok: z.boolean(),
      orderId: z.number().int(),
      paymentMethod: z.string(),
      status: z.enum(['pending', 'completed', 'cancelled', 'expired']),
      paymentNumber: z.string().nullable(),
      totalPayment: z.number().int(),
      qrImage: z.string().nullable(),
      expiredAt: z.number().int().nullable(),
    }),
    execute: async ({ orderId, amountIdr, paymentMethod }) => {
      const service = new PakasirService({ db, tenantId });
      const result = await service.createTransaction({
        orderId: String(orderId),
        amount: amountIdr,
        method: paymentMethod,
      });

      let qrImage: string | null = null;
      if (result.payment.paymentNumber && paymentMethod === 'qris') {
        qrImage = await QRCode.toDataURL(result.payment.paymentNumber, {
          width: 256,
          margin: 2,
        });
      }

      return {
        ok: true,
        orderId,
        paymentMethod: result.payment.paymentMethod,
        status: result.payment.status,
        paymentNumber: result.payment.paymentNumber,
        totalPayment: result.payment.totalPayment,
        qrImage,
        expiredAt: result.payment.expiredAt ?? null,
      };
    },
  });

  return { requestPayment };
}

export function createCheckPaymentTool({ db, tenantId }: CustomerPaymentToolDeps) {
  const checkPayment = createTool({
    id: 'check-payment',
    description: 'Cek status pembayaran pesanan dari database lokal.',
    inputSchema: z.object({
      orderId: z.number().int().positive(),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      status: z.enum(['pending', 'completed', 'cancelled', 'expired']).nullable(),
      amountIdr: z.number().int().nullable(),
      paymentMethod: z.string().nullable(),
      completedAt: z.number().int().nullable(),
    }),
    execute: async ({ orderId }) => {
      const service = new PakasirService({ db, tenantId });
      const record = await service.checkPaymentStatus(String(orderId));
      if (!record) {
        return { found: false, status: null, amountIdr: null, paymentMethod: null, completedAt: null };
      }
      return {
        found: true,
        status: record.status,
        amountIdr: record.amountIdr,
        paymentMethod: record.paymentMethod,
        completedAt: record.completedAt,
      };
    },
  });

  return { checkPayment };
}