import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: Check current stock levels
const checkStockStep = createStep({
  id: 'check-stock',
  inputSchema: z.object({
    tenantId: z.string(),
    lowStockOnly: z.boolean().default(true),
  }),
  outputSchema: z.object({
    lowStockProducts: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        currentStock: z.number(),
        minStock: z.number().nullable(),
      }),
    ),
  }),
  execute: async ({ inputData }) => {
    // Will be connected to list-products tool
    return {
      lowStockProducts: [],
    };
  },
});

// Step 2: Select supplier and products to order
const selectProductsStep = createStep({
  id: 'select-products',
  inputSchema: z.object({
    products: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        quantity: z.number(),
      }),
    ),
    supplierName: z.string(),
  }),
  outputSchema: z.object({
    draftPoItems: z.array(
      z.object({
        productName: z.string(),
        quantity: z.number(),
        estimatedPrice: z.number().nullable(),
      }),
    ),
    totalEstimate: z.number().nullable(),
  }),
  execute: async ({ inputData }) => {
    return {
      draftPoItems: inputData.products.map((p) => ({
        productName: p.name,
        quantity: p.quantity,
        estimatedPrice: null,
      })),
      totalEstimate: null,
    };
  },
});

// Step 3: Generate PO draft and suspend for approval
const generatePoStep = createStep({
  id: 'generate-po',
  inputSchema: z.object({
    draftPoItems: z.array(
      z.object({
        productName: z.string(),
        quantity: z.number(),
        estimatedPrice: z.number().nullable(),
      }),
    ),
    supplierName: z.string(),
    tenantId: z.string(),
  }),
  outputSchema: z.object({
    poDraftPath: z.string(),
    suspended: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    // PO draft saved via write_file tool in real implementation
    const date = new Date().toISOString().split('T')[0];
    return {
      poDraftPath: `data/workspaces/${inputData.tenantId}/owner/files/draft-po-${date}.txt`,
      suspended: true, // waits for owner /approve
    };
  },
});

// Step 4: Confirm order after owner approval
const confirmOrderStep = createStep({
  id: 'confirm-order',
  inputSchema: z.object({
    supplierName: z.string(),
    approved: z.boolean(),
    poDraftPath: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      success: inputData.approved,
      message: inputData.approved
        ? `PO sent to ${inputData.supplierName}`
        : 'PO draft rejected',
    };
  },
});

export const restockWorkflow = createWorkflow({
  id: 'restock',
  inputSchema: z.object({
    tenantId: z.string(),
    supplierName: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(checkStockStep)
  .then(selectProductsStep)
  .then(generatePoStep)
  .then(confirmOrderStep)
  .commit();

export type RestockWorkflow = typeof restockWorkflow;
