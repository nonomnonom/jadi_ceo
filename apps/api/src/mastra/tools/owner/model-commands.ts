import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';
import { getSetting, setSetting } from '../../../db/settings.js';

export type ModelCommandDeps = { db: Db; tenantId: string };

const SUPPORTED_PROVIDERS = [
  'openrouter/anthropic/claude-sonnet-4-6',
  'openrouter/anthropic/claude-sonnet-4-5',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'google/gemini-2.5-pro',
  'google/gemini-2.0-flash',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-sonnet-4-5',
] as const;

export function createModelCommandTools({ db, tenantId }: ModelCommandDeps) {
  const getCurrentModel = createTool({
    id: 'get-current-model',
    description:
      'Cek model AI yang sedang digunakan Owner Agent. Gunakan saat owner minta "/model" tanpa argumen.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      currentModel: z.string(),
      provider: z.string(),
    }),
    execute: async () => {
      const model = (await getSetting(db, tenantId, 'ownerModel')) || 'openrouter/anthropic/claude-sonnet-4-6';
      const providerPart = model.split('/')[0] ?? 'unknown';

      return {
        currentModel: model,
        provider: providerPart,
      };
    },
  });

  const switchModel = createTool({
    id: 'switch-model',
    description:
      'Ganti model AI yang digunakan Owner Agent. Gunakan saat owner minta "/model [provider/model]". Contoh: "/model openai/gpt-4o".',
    inputSchema: z.object({
      model: z.string().describe('Nama model lengkap (contoh: openrouter/anthropic/claude-sonnet-4-6)'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      newModel: z.string(),
    }),
    execute: async ({ model }) => {
      // Validate model format
      if (!model.includes('/')) {
        return {
          success: false,
          message: `Format model salah. Gunakan format "provider/model", contoh: "openai/gpt-4o" atau "openrouter/anthropic/claude-sonnet-4-6".`,
          newModel: '',
        };
      }

      // Check if model is in supported list (or allow any for flexibility)
      // For now, just save it - the model router will validate at runtime
      await setSetting(db, tenantId, 'ownerModel', model);

      return {
        success: true,
        message: `✅ Model berhasil diganti ke "${model}". Perubahan akan生效 setelah restart server.`,
        newModel: model,
      };
    },
  });

  const listSupportedModels = createTool({
    id: 'list-supported-models',
    description: 'Daftar model AI yang didukung.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      models: z.array(z.string()),
    }),
    execute: async () => {
      return {
        models: [...SUPPORTED_PROVIDERS],
      };
    },
  });

  return { getCurrentModel, switchModel, listSupportedModels };
}
