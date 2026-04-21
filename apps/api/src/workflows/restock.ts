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
      lowStockProducts,
      totalLowStock: lowStockProducts.length,
    };
  },
});

// Step 2: Look up suppliers and select products to order
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
  }),
  outputSchema: z.object({
    suppliers: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        phone: z.string().nullable(),
      }),
    ),
    products: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        suggestedQty: z.number(),
      }),
    ),
    suspendPayload: z
      .object({
        reason: z.string(),
        products: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            currentStock: z.number(),
            suggestedQty: z.number(),
          }),
        ),
      })
      .optional(),
  }),
  resumeSchema: z.object({
    action: z.enum(['approve', 'reject']),
    selectedProductIds: z.array(z.number()),
    supplierId: z.number().optional(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const db = getDb();
    const { tenantId, lowStockProducts } = inputData;

    // Get suppliers
    const supplierResult = await db.execute({
      sql: `SELECT id, name, phone FROM contacts WHERE tenant_id = ? AND type = 'supplier' ORDER BY name`,
      args: [tenantId],
    });

    const suppliers = supplierResult.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      phone: r.phone ? String(r.phone) : null,
    }));

    if (resumeData) {
      // Resume with selected products
      const { action, selectedProductIds } = resumeData;
      const selectedProducts = lowStockProducts.filter((p) =>
        selectedProductIds.includes(p.id)
      );

      if (action === 'reject' || selectedProductIds.length === 0) {
        return {
          suppliers,
          products: [],
          suspendPayload: undefined,
        };
      }

      return {
        suppliers,
        products: selectedProducts.map((p) => ({
          id: p.id,
          name: p.name,
          suggestedQty: p.suggestedReorder,
        })),
        suspendPayload: undefined,
      };
    }

    // First run - suspend for owner to select products
    const reason = `Low stock alert: ${lowStockProducts.length} produk perlu restock. Pilih produk dan supplier untuk membuat PO.`;

    return suspend({
      reason,
      products: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        currentStock: p.currentStock,
        suggestedQty: p.suggestedReorder,
      })),
    });
  },
});

// Step 3: Generate PO draft and suspend for approval
const generatePoStep = createStep({
  id: 'generate-po',
  inputSchema: z.object({
    products: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        suggestedQty: z.number(),
      }),
    ),
    supplierId: z.number().optional(),
    tenantId: z.string(),
  }),
  outputSchema: z.object({
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
    suspendPayload: z
      .object({
        reason: z.string(),
        poDraft: z.object({
          items: z.array(
            z.object({
              productName: z.string(),
              quantity: z.number(),
              estimatedPrice: z.number().nullable(),
            }),
          ),
          totalEstimate: z.number().nullable(),
        }),
      })
      .optional(),
  }),
  resumeSchema: z.object({
    action: z.enum(['approve', 'reject']),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const db = getDb();
    const { products, tenantId } = inputData;

    if (products.length === 0) {
      return {
        poDraft: {
          items: [],
          totalEstimate: null,
          generatedAt: new Date().toISOString(),
        },
        suspendPayload: undefined,
      };
    }

    // Get product prices for estimation
    const productIds = products.map((p) => p.id);
    const placeholders = productIds.map(() => '?').join(',');
    const priceResult = await db.execute({
      sql: `SELECT id, price_idr FROM products WHERE id IN (${placeholders})`,
      args: productIds,
    });

    const priceMap = new Map<number, number>();
    for (const row of priceResult.rows) {
      priceMap.set(Number(row.id), Number(row.price_idr));
    }

    const poItems = products.map((p) => ({
      productName: p.name,
      quantity: p.suggestedQty,
      estimatedPrice: priceMap.get(p.id) ?? null,
    }));

    const totalEstimate = poItems.reduce(
      (sum, item) => sum + (item.estimatedPrice ?? 0) * item.quantity,
      0
    );

    const poDraft = {
      items: poItems,
      totalEstimate,
      generatedAt: new Date().toISOString(),
    };

    if (!resumeData) {
      // Suspend for owner approval
      return suspend({
        reason: `Draft PO siap untuk di-review: ${products.length} item, estimasi total Rp ${totalEstimate.toLocaleString('id-ID')}. Ketik /restock approve untuk approve atau /restock reject untuk tolak.`,
        poDraft,
      });
    }

    // Resume with approval/rejection
    return {
      poDraft,
      suspendPayload: undefined,
    };
  },
});

// Step 4: Confirm order after owner approval and create draft PO file
const confirmOrderStep = createStep({
  id: 'confirm-order',
  inputSchema: z.object({
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
    resumeData: z
      .object({
        action: z.enum(['approve', 'reject']),
      })
      .optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    poDraftPath: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { poDraft } = inputData;
    const action = inputData.resumeData?.action;

    if (poDraft.items.length === 0) {
      return {
        success: false,
        message: 'Tidak ada item untuk diorder',
        poDraftPath: undefined,
      };
    }

    if (action === 'reject') {
      return {
        success: false,
        message: 'PO draft ditolak oleh owner',
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
      poDraftPath: `data/workspaces/default/owner/files/draft-po-${Date.now()}.txt`,
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
