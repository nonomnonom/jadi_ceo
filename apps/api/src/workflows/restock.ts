import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { getDb } from '../db/client.js';

// Step 1: Check current stock levels and find low stock products
const checkStockStep = createStep({
  id: 'check-stock',
  inputSchema: z.object({
    tenantId: z.string(),
    lowStockOnly: z.boolean().default(true),
  }),
  outputSchema: z.object({
    tenantId: z.string(),
    lowStockProducts: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        currentStock: z.number(),
        lowStockAt: z.number(),
        suggestedReorder: z.number(),
      }),
    ),
    totalLowStock: z.number(),
  }),
  execute: async ({ inputData }) => {
    const db = getDb();
    const { tenantId, lowStockOnly } = inputData;

    let sql = `SELECT id, name, stock_qty, low_stock_at FROM products WHERE tenant_id = ?`;
    const args: (string | number)[] = [tenantId];

    if (lowStockOnly) {
      sql += ` AND stock_qty <= low_stock_at AND low_stock_at > 0`;
    }

    sql += ` ORDER BY stock_qty ASC`;

    const result = await db.execute({ sql, args });

    const lowStockProducts = result.rows
      .map((r) => ({
        id: Number(r.id),
        name: String(r.name),
        currentStock: Number(r.stock_qty),
        lowStockAt: Number(r.low_stock_at),
        suggestedReorder: Math.max(0, Number(r.low_stock_at) * 2 - Number(r.stock_qty)),
      }))
      .filter((p) => p.currentStock <= p.lowStockAt && p.lowStockAt > 0);

    return {
      tenantId,
      lowStockProducts,
      totalLowStock: lowStockProducts.length,
    };
  },
});

// Step 2: Look up suppliers and select products to order (suspend for owner input)
const lookupSuppliersStep = createStep({
  id: 'lookup-suppliers',
  inputSchema: z.object({
    tenantId: z.string(),
    lowStockProducts: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        currentStock: z.number(),
        lowStockAt: z.number(),
        suggestedReorder: z.number(),
      }),
    ),
    totalLowStock: z.number(),
  }),
  outputSchema: z.object({
    tenantId: z.string(),
    selectedProducts: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        suggestedQty: z.number(),
      }),
    ),
    poDraft: z
      .object({
        items: z.array(
          z.object({
            productName: z.string(),
            quantity: z.number(),
            estimatedPrice: z.number().nullable(),
          }),
        ),
        totalEstimate: z.number().nullable(),
        generatedAt: z.string(),
      })
      .optional(),
    suspended: z.boolean(),
    suspendReason: z.string().optional(),
  }),
  resumeSchema: z.object({
    action: z.enum(['approve', 'reject']),
    selectedProductIds: z.array(z.number()).optional(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const db = getDb();
    const { tenantId, lowStockProducts } = inputData;

    // Get suppliers
    const supplierResult = await db.execute({
      sql: `SELECT id, name, phone FROM contacts WHERE tenant_id = ? AND type = 'supplier' ORDER BY name`,
      args: [tenantId],
    });

    if (resumeData) {
      // Resume with selected products
      const { action, selectedProductIds } = resumeData;

      if (action === 'reject' || !selectedProductIds || selectedProductIds.length === 0) {
        return {
          tenantId,
          selectedProducts: [],
          poDraft: undefined,
          suspended: false,
        };
      }

      const selectedProducts = lowStockProducts.filter((p) =>
        selectedProductIds.includes(p.id)
      );

      // Get product prices for estimation
      const priceResult = await db.execute({
        sql: `SELECT id, price_idr FROM products WHERE id IN (${selectedProductIds.map(() => '?').join(',')})`,
        args: selectedProductIds,
      });

      const priceMap = new Map<number, number>();
      for (const row of priceResult.rows) {
        priceMap.set(Number(row.id), Number(row.price_idr));
      }

      const poItems = selectedProducts.map((p) => ({
        productName: p.name,
        quantity: p.suggestedReorder,
        estimatedPrice: priceMap.get(p.id) ?? null,
      }));

      const totalEstimate = poItems.reduce(
        (sum, item) => sum + (item.estimatedPrice ?? 0) * item.quantity,
        0
      );

      return {
        tenantId,
        selectedProducts: selectedProducts.map((p) => ({
          id: p.id,
          name: p.name,
          suggestedQty: p.suggestedReorder,
        })),
        poDraft: {
          items: poItems,
          totalEstimate,
          generatedAt: new Date().toISOString(),
        },
        suspended: false,
      };
    }

    // First run - suspend for owner to select products
    const reason = `Low stock alert: ${lowStockProducts.length} produk perlu restock. Kirim /restock select [id1,id2] untuk pilih produk, atau /restock reject untuk batal.`;

    return suspend({
      reason,
    });
  },
});

// Step 3: Generate PO draft and suspend for final approval
const generatePoStep = createStep({
  id: 'generate-po',
  inputSchema: z.object({
    tenantId: z.string(),
    selectedProducts: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        suggestedQty: z.number(),
      }),
    ),
    poDraft: z
      .object({
        items: z.array(
          z.object({
            productName: z.string(),
            quantity: z.number(),
            estimatedPrice: z.number().nullable(),
          }),
        ),
        totalEstimate: z.number().nullable(),
        generatedAt: z.string(),
      })
      .optional(),
    suspended: z.boolean(),
    suspendReason: z.string().optional(),
  }),
  outputSchema: z.object({
    tenantId: z.string(),
    poDraft: z.object({
      items: z.array(
        z.object({
          productName: z.string(),
          quantity: z.number(),
          estimatedPrice: z.number().nullable(),
        }),
      ),
      totalEstimate: z.number().nullable(),
      generatedAt: z.string(),
    }),
    suspended: z.boolean(),
    suspendReason: z.string().optional(),
    approved: z.boolean().optional(),
  }),
  resumeSchema: z.object({
    action: z.enum(['approve', 'reject']),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { tenantId, selectedProducts, poDraft, suspended } = inputData;

    // If no products selected or rejected earlier, skip
    if (!selectedProducts.length || !poDraft) {
      return {
        tenantId,
        poDraft: {
          items: [],
          totalEstimate: null,
          generatedAt: new Date().toISOString(),
        },
        suspended: false,
      };
    }

    if (suspended) {
      // This step was re-entered after suspend in lookupSuppliersStep
      // But since we already have poDraft, just continue
    }

    if (!resumeData) {
      // Suspend for final owner approval
      return suspend({
        reason: `Draft PO siap: ${selectedProducts.length} item, estimasi Rp ${(poDraft.totalEstimate ?? 0).toLocaleString('id-ID')}. Ketik /restock approve untuk approve atau /restock reject untuk tolak.`,
      });
    }

    // Resume with approval/rejection
    return {
      tenantId,
      poDraft,
      suspended: false,
      approved: resumeData.action === 'approve',
    };
  },
});

// Step 4: Confirm order after owner approval and create draft PO file
const confirmOrderStep = createStep({
  id: 'confirm-order',
  inputSchema: z.object({
    tenantId: z.string(),
    poDraft: z.object({
      items: z.array(
        z.object({
          productName: z.string(),
          quantity: z.number(),
          estimatedPrice: z.number().nullable(),
        }),
      ),
      totalEstimate: z.number().nullable(),
      generatedAt: z.string(),
    }),
    suspended: z.boolean(),
    suspendReason: z.string().optional(),
    approved: z.boolean().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    poDraftPath: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { tenantId, poDraft, approved } = inputData;

    if (!approved || poDraft.items.length === 0) {
      return {
        success: false,
        message: 'PO draft ditolak atau tidak ada item',
        poDraftPath: undefined,
      };
    }

    // Generate PO draft file content
    const date = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    let poContent = `DRAFT PURCHASE ORDER\n`;
    poContent += `Tanggal: ${date}\n`;
    poContent += `${'='.repeat(40)}\n\n`;

    for (const item of poDraft.items) {
      const price = item.estimatedPrice ? `Rp ${item.estimatedPrice.toLocaleString('id-ID')}` : 'TBD';
      poContent += `${item.productName}\n`;
      poContent += `  Qty: ${item.quantity} x ${price}\n\n`;
    }

    poContent += `${'='.repeat(40)}\n`;
    poContent += `Estimasi Total: Rp ${(poDraft.totalEstimate ?? 0).toLocaleString('id-ID')}\n`;
    poContent += `\nStatus: DRAFT - Menunggu konfirmasi supplier\n`;

    return {
      success: true,
      message: `PO draft siap: ${poDraft.items.length} item, estimasi Rp ${(poDraft.totalEstimate ?? 0).toLocaleString('id-ID')}`,
      poDraftPath: `data/workspaces/${tenantId}/owner/files/draft-po-${Date.now()}.txt`,
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
  .then(lookupSuppliersStep)
  .then(generatePoStep)
  .then(confirmOrderStep)
  .commit();

export type RestockWorkflow = typeof restockWorkflow;
