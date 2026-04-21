import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';

export type RetryCommandDeps = { db: Db; tenantId: string };

// In-memory store for last failed action (survives within process lifetime)
// For distributed scenarios, this would need Redis or similar
let lastFailedAction: {
  actionType: string;
  params: Record<string, unknown>;
  timestamp: number;
  error: string;
} | null = null;

export function recordFailedAction(actionType: string, params: Record<string, unknown>, error: string): void {
  lastFailedAction = {
    actionType,
    params,
    timestamp: Date.now(),
    error,
  };
}

export function getLastFailedAction(): typeof lastFailedAction {
  return lastFailedAction;
}

export function clearFailedAction(): void {
  lastFailedAction = null;
}

export function createRetryCommandTools(_deps: RetryCommandDeps) {
  const getRetryStatus = createTool({
    id: 'get-retry-status',
    description:
      'Cek apakah ada action yang gagal dan bisa di-retry. Gunakan saat owner mau tahu apakah ada yang bisa diulang.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      hasFailedAction: z.boolean(),
      actionType: z.string().nullable(),
      timestamp: z.number().int().nullable(),
      errorPreview: z.string().nullable(),
      canRetry: z.boolean(),
    }),
    execute: async () => {
      const failed = getLastFailedAction();
      const hasFailedAction = failed !== null;
      const canRetry = hasFailedAction && (Date.now() - failed!.timestamp < 3600000); // 1 hour window

      return {
        hasFailedAction,
        actionType: failed?.actionType ?? null,
        timestamp: failed?.timestamp ?? null,
        errorPreview: failed?.error ? failed.error.slice(0, 200) : null,
        canRetry,
      };
    },
  });

  const retryLastAction = createTool({
    id: 'retry-last-action',
    description:
      'Jalankan ulang action yang terakhir gagal. Gunakan saat owner bilang "/retry". Akan throw error jika tidak ada action yang gagal atau sudah expired.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      actionType: z.string(),
      message: z.string(),
      result: z.unknown().nullable(),
    }),
    execute: async () => {
      const failed = getLastFailedAction();

      if (!failed) {
        return {
          success: false,
          actionType: 'none',
          message: 'Tidak ada action yang gagal untuk di-retry.',
          result: null,
        };
      }

      // Check if expired (1 hour)
      if (Date.now() - failed.timestamp > 3600000) {
        clearFailedAction();
        return {
          success: false,
          actionType: failed.actionType,
          message: 'Action sudah expired (lebih dari 1 jam). Silakan ulangi manual.',
          result: null,
        };
      }

      // Return the params so the agent can retry with the same params
      clearFailedAction(); // Clear after retrieving

      return {
        success: true,
        actionType: failed.actionType,
        message: `Action "${failed.actionType}" siap di-retry. params: ${JSON.stringify(failed.params)}`,
        result: failed.params,
      };
    },
  });

  const clearRetry = createTool({
    id: 'clear-retry',
    description: 'Hapus record action gagal. Gunakan saat owner mau bersih-bersih.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async () => {
      clearFailedAction();
      return {
        success: true,
        message: 'Record action gagal sudah dibersihkan.',
      };
    },
  });

  return { getRetryStatus, retryLastAction, clearRetry };
}
