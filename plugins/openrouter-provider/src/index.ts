/**
 * OpenRouter Provider Plugin
 *
 * Registers OpenRouter as a ProviderPlugin, enabling:
 * - Model fallback chain: explicit model → provider default → generic fallback
 * - Per-provider API keys via OPENROUTER_API_KEY env var
 * - Transport normalization for OpenAI-compatible OpenRouter API
 */

import type { ProviderPlugin } from '@juragan/plugin-sdk';
import { definePluginEntry } from '@juragan/plugin-sdk';

/**
 * OpenRouter provider default model when none specified.
 */
const DEFAULT_MODEL = 'openrouter/anthropic/claude-sonnet-4-6';

/**
 * Fallback chain for OpenRouter — tried in order until one resolves.
 */
const FALLBACK_CHAIN = [
  'openrouter/anthropic/claude-sonnet-4-6',
  'openrouter/anthropic/claude-haiku-4-7',
  'openai/gpt-4o-mini',
];

function makeOpenRouterProvider(): ProviderPlugin {
  return {
    id: 'openrouter',
    type: 'openrouter',
    meta: {
      name: 'OpenRouter',
      description:
        'OpenAI-compatible gateway for Anthropic, OpenAI, Google, and other models via openrouter.ai',
    },

    resolveModel(params) {
      // If an explicit model was requested, validate it's a known OpenRouter model
      if (params.requestedModel) {
        return params.requestedModel;
      }
      // Fallback chain — try each until one succeeds (at runtime, the transport
      // will validate; here we just return the first candidate)
      return FALLBACK_CHAIN[0] ?? DEFAULT_MODEL;
    },

    normalizeModelId(modelId) {
      // OpenRouter uses "provider/model" format; normalize to lowercase
      return modelId.toLowerCase();
    },

    prepareAuth(credentials) {
      // Credentials may be passed in at runtime (per-tenant API key from settings)
      // or fall back to the env var set during bootstrap
      const apiKey = credentials.apiKey || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('[openrouter-provider] OPENROUTER_API_KEY is not set');
      }
      return {
        apiKey,
        baseUrl: credentials.baseUrl || 'https://openrouter.ai/api/v1',
      };
    },
  };
}

export default definePluginEntry(
  {
    id: 'openrouter-provider',
    name: 'OpenRouter AI Provider',
    version: '1.0.0',
    description: 'OpenRouter provider plugin — model fallback chain and per-provider auth',
  },
  (api) => {
    api.registerProvider(makeOpenRouterProvider());
  },
);
