import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import { formatIDR } from '@juragan/shared';

// Input: orderId from customer WhatsApp order
const orderApprovalInputSchema = z.object({
  orderId: z.number(),
  tenantId: z.string(),
});

const orderApprovalOutputSchema = z.object({
  success: z.boolean(),
  orderId: z.number(),
  message: z.string(),
});

// Step 1: Validate order exists and is pending, fetch order details
const validateOrderStep = createStep({
  id: 'validate-order',
  inputSchema: z.object({
    orderId: z.number(),
    tenantId: z.string(),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    orderId: z.number(),
    customerPhone: z.string(),
    productName: z.string(),
    qty: z.number(),
    totalIdr: z.number(),
    totalFormatted: z.string(),
    status: z.string(),
    suspendPayload: z
      .object({
        reason: z.string(),
        orderId: z.number(),
        customerPhone: z.string(),
        productName: z.string(),
        qty: z.number(),
        totalFormatted: z.string(),
      })
      .optional(),
  }),
  execute: async ({ inputData, suspend }) => {
    const db = getDb();
    const { orderId, tenantId } = inputData;

    const result = await db.execute({
      sql: `SELECT o.id, o.customer_phone, o.qty, o.total_idr, o.status, p.name as product_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.id = ? AND o.tenant_id = ?`,
      args: [orderId, tenantId],
    });

    if (result.rows.length === 0) {
      return {
        valid: false,
        orderId,
        customerPhone: '',
        productName: '',
        qty: 0,
        totalIdr: 0,
        totalFormatted: 'Rp 0',
        status: 'not_found',
        suspendPayload: undefined,
      };
    }

    const order = result.rows[0]!;
    const status = String(order.status);

    // Only suspend if order is pending
    if (status !== 'pending') {
      return {
        valid: false,
        orderId,
        customerPhone: String(order.customer_phone),
        productName: String(order.product_name),
        qty: Number(order.qty),
        totalIdr: Number(order.total_idr),
        totalFormatted: formatIDR(Number(order.total_idr)),
        status,
        suspendPayload: undefined,
      };
    }

    // Suspend for owner approval - return payload for the owner to see
    return suspend({
      reason: `Order #${orderId} dari ${order.customer_phone} - ${order.product_name} x${order.qty} = ${formatIDR(Number(order.total_idr))}. Ketik /order approve ${orderId} atau /order reject ${orderId}`,
      orderId,
      customerPhone: String(order.customer_phone),
      productName: String(order.product_name),
      qty: Number(order.qty),
      totalFormatted: formatIDR(Number(order.total_idr)),
    });
  },
});

// Step 2: Process owner approval/rejection
const processApprovalStep = createStep({
  id: 'process-approval',
  inputSchema: z.object({
    orderId: z.number(),
    customerPhone: z.string(),
    productName: z.string(),
    qty: z.number(),
    totalFormatted: z.string(),
    suspendPayload: z
      .object({
        reason: z.string(),
        orderId: z.number(),
        customerPhone: z.string(),
        productName: z.string(),
        qty: z.number(),
        totalFormatted: z.string(),
      })
      .optional(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    orderId: z.number(),
    customerPhone: z.string(),
    productName: z.string(),
    qty: z.number(),
    message: z.string(),
  }),
  resumeSchema: z.object({
    action: z.enum(['approve', 'reject']),
  }),
  execute: async ({ inputData, resumeData }) => {
    const db = getDb();
    const { orderId, customerPhone, productName, qty } = inputData;
    const action = resumeData?.action;

    if (!action) {
      // First run - this shouldn't happen if we suspend correctly
      return {
        approved: false,
        orderId,
        customerPhone,
        productName,
        qty,
        message: 'No action taken',
      };
    }

    const now = Date.now();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db.execute({
      sql: 'UPDATE orders SET status = ?, updated_at = ? WHERE id = ?',
      args: [newStatus, now, orderId],
    });

    // Record status history
    await db.execute({
      sql: `INSERT INTO order_status_history (tenant_id, order_id, old_status, new_status, changed_by, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: ['default', orderId, 'pending', newStatus, 'owner-workflow', `Approved via workflow`, now],
    });

    const message =
      action === 'approve'
        ? `Order #${orderId} disetujui. Product: ${productName} x${qty} akan diproses.`
        : `Order #${orderId} ditolak.`;

    return {
      approved: action === 'approve',
      orderId,
      customerPhone,
      productName,
      qty,
      message,
    };
  },
});

// Step 3: Send notification to customer via WhatsApp (after approval)
const notifyCustomerStep = createStep({
  id: 'notify-customer',
  inputSchema: z.object({
    orderId: z.number(),
    customerPhone: z.string(),
    productName: z.string(),
    qty: z.number(),
    approved: z.boolean(),
    message: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    orderId: z.number(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { orderId, customerPhone, approved, message } = inputData;

    // Return structured data for the agent to send WhatsApp message
    // The agent will handle actual WhatsApp sending
    if (!approved || !customerPhone) {
      return {
        success: false,
        orderId,
        message: 'No notification sent - order was rejected',
      };
    }

    return {
      success: true,
      orderId,
      message: `Notification ready for ${customerPhone}: "${message}"`,
    };
  },
});

export const orderApprovalWorkflow = createWorkflow({
  id: 'order-approval',
  inputSchema: orderApprovalInputSchema,
  outputSchema: orderApprovalOutputSchema,
})
  .then(validateOrderStep)
  .then(processApprovalStep)
  .then(notifyCustomerStep)
  .commit();

export type OrderApprovalWorkflow = typeof orderApprovalWorkflow;
