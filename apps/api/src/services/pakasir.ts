import { getSetting } from '../db/settings.js';
import type { Db } from '../db/client.js';

export type PakasirPaymentMethod = 'qris' | 'cimb_niaga_va' | 'bni_va' | 'bri_va' | 'mandiri_va';

export interface PakasirPaymentRecord {
  orderId: string;
  amountIdr: number;
  totalPayment: number;
  paymentMethod: PakasirPaymentMethod;
  paymentNumber: string | null;
  status: 'pending' | 'completed' | 'cancelled' | 'expired';
  expiredAt: number | null;
  completedAt: number | null;
}

export class PakasirService {
  private baseUrl = 'https://app.pakasir.com/api';
  private db: Db;
  private tenantId: string;

  constructor({ db, tenantId }: { db: Db; tenantId: string }) {
    this.db = db;
    this.tenantId = tenantId;
  }

  private async getCredentials(): Promise<{ project: string; apiKey: string }> {
    const db = this.db;
    const project = await getSetting(db, this.tenantId, 'pakasirProject' as any);
    const apiKey = await getSetting(db, this.tenantId, 'pakasirApiKey' as any);
    if (!project || !apiKey) {
      throw new Error('Pakasir credentials not configured');
    }
    return { project, apiKey };
  }

  async createTransaction(params: {
    orderId: string;
    amount: number;
    method: PakasirPaymentMethod;
  }): Promise<{ payment: PakasirPaymentRecord }> {
    const { orderId, amount, method } = params;
    const { project, apiKey } = await this.getCredentials();

    const url = `${this.baseUrl}/transactioncreate/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, order_id: orderId, amount, api_key: apiKey }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` })) as { error?: string };
      throw new Error(`Pakasir API error: ${errData.error ?? response.status}`);
    }

    const data = (await response.json()) as {
      payment: {
        project: string;
        order_id: string;
        amount: number;
        fee: number;
        total_payment: number;
        payment_method: string;
        payment_number: string;
        expired_at: string;
      };
    };

    const now = Date.now();
    const expiredAt = data.payment.expired_at
      ? new Date(data.payment.expired_at).getTime()
      : null;

    // Persist payment record
    await this.db.execute({
      sql: `INSERT INTO payments (tenant_id, order_id, amount_idr, fee, total_payment, payment_method, payment_number, status, expired_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      args: [
        this.tenantId,
        orderId,
        amount,
        data.payment.fee,
        data.payment.total_payment,
        data.payment.payment_method,
        data.payment.payment_number,
        expiredAt,
        now,
        now,
      ],
    });

    return {
      payment: {
        orderId: data.payment.order_id,
        amountIdr: data.payment.amount,
        totalPayment: data.payment.total_payment,
        paymentMethod: data.payment.payment_method as PakasirPaymentMethod,
        paymentNumber: data.payment.payment_number,
        status: 'pending',
        expiredAt,
        completedAt: null,
      },
    };
  }

  async checkPaymentStatus(orderId: string): Promise<PakasirPaymentRecord | null> {
    const result = await this.db.execute({
      sql: `SELECT order_id, amount_idr, total_payment, payment_method, payment_number, status, expired_at, completed_at
            FROM payments WHERE tenant_id = ? AND order_id = ?`,
      args: [this.tenantId, orderId],
    });
    if (result.rows.length === 0) return null;
    const r = result.rows[0]!;
    return {
      orderId: String(r.order_id),
      amountIdr: Number(r.amount_idr),
      totalPayment: Number(r.total_payment),
      paymentMethod: r.payment_method as PakasirPaymentMethod,
      paymentNumber: r.payment_number != null ? String(r.payment_number) : null,
      status: r.status as 'pending' | 'completed' | 'cancelled' | 'expired',
      expiredAt: r.expired_at != null ? Number(r.expired_at) : null,
      completedAt: r.completed_at != null ? Number(r.completed_at) : null,
    };
  }

  async simulatePayment(orderId: string): Promise<void> {
    const { project, apiKey } = await this.getCredentials();
    const url = `${this.baseUrl}/paymentsimulation`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, order_id: orderId, api_key: apiKey }),
    });
    if (!response.ok) {
      throw new Error(`Simulation failed: HTTP ${response.status}`);
    }

    const now = Date.now();
    await this.db.execute({
      sql: "UPDATE payments SET status = 'completed', completed_at = ?, updated_at = ? WHERE order_id = ? AND tenant_id = ?",
      args: [now, now, orderId, this.tenantId],
    });
    await this.db.execute({
      sql: "UPDATE orders SET payment_status = 'paid' WHERE id = ? AND tenant_id = ?",
      args: [orderId, this.tenantId],
    });
  }

  async cancelTransaction(orderId: string): Promise<void> {
    const { project, apiKey } = await this.getCredentials();
    const url = `${this.baseUrl}/transactioncancel`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, order_id: orderId, api_key: apiKey }),
    });
    if (!response.ok) {
      throw new Error(`Cancel failed: HTTP ${response.status}`);
    }

    const now = Date.now();
    await this.db.execute({
      sql: "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE order_id = ? AND tenant_id = ? AND status = 'pending'",
      args: [now, orderId, this.tenantId],
    });
  }
}