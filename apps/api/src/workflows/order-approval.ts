import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

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

// Step 1: Validate order exists and is pending
const validateOrderStep = createStep({
  id: 'validate-order',
  inputSchema: z.object({
    orderId: z.number(),
    tenantId: z.string(),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    orderId: z.number(),
    customerPhone: z.string().nullable(),
    orderDescription: z.string().nullable(),
  }),
  execute: async ({ inputData }) => {
    // Note: DB access will be injected via context in real implementation
    // This is a placeholder that will be connected to actual DB
    return {
      valid: inputData.orderId > 0,
      orderId: inputData.orderId,
      customerPhone: null, // will be fetched from DB
      orderDescription: null,
    };
  },
});

// Step 2: Send notification to owner via Telegram
const notifyOwnerStep = createStep({
  id: 'notify-owner',
  inputSchema: z.object({
    orderId: z.number(),
    customerPhone: z.string().nullable(),
    orderDescription: z.string().nullable(),
  }),
  outputSchema: z.object({
    notified: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Telegram notification will be handled by the agent layer
    // This step suspends and waits for owner /order approve/reject
    return {
      notified: true,
      message: `Order #${inputData.orderId} pending approval`,
    };
  },
});

// Step 3: Notify customer via WhatsApp (after approval)
const notifyCustomerStep = createStep({
  id: 'notify-customer',
  inputSchema: z.object({
    orderId: z.number(),
    customerPhone: z.string().nullable(),
    approved: z.boolean(),
    message: z.string(),
  }),
  outputSchema: z.object({
    messageSent: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    // WhatsApp notification handled by customer agent layer
    return {
      messageSent: inputData.approved && inputData.customerPhone !== null,
    };
  },
});

export const orderApprovalWorkflow = createWorkflow({
  id: 'order-approval',
  inputSchema: orderApprovalInputSchema,
  outputSchema: orderApprovalOutputSchema,
})
  .then(validateOrderStep)
  .then(notifyOwnerStep)
  .then(notifyCustomerStep)
  .commit();

export type OrderApprovalWorkflow = typeof orderApprovalWorkflow;
