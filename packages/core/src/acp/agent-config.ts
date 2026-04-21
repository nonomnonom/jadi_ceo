/**
 * ACP Agent Config Resolution — agent.yaml schema + workspace path resolution.
 *
 * Provides:
 * - AgentConfigSchema — validates agent.yaml files
 * - resolveAgentWorkspace(agentId, tenantId) — resolves workspace path per tenant
 * - resolveAgentConfig(agentId) — loads and caches agent config
 * - Skill resolution helpers
 */

import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getPluginManager } from '../plugin-manager.js';

// Re-export shared types
export type { ToolDefinition } from './manager.js';

export const AgentConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  model: z.string().optional(),
  mode: z.enum(['run', 'session']).optional(),
  skills: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  workspace: z.string().optional(),
  memory: z
    .object({
      lastMessages: z.number().optional(),
      relevantFiles: z.number().optional(),
    })
    .optional(),
  channels: z.array(z.string()).optional(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Resolve the workspace path for an agent given tenantId.
 * Pattern: data/workspaces/{tenantId}/agents/{agentId}
 */
export function resolveAgentWorkspace(agentId: string, tenantId: string): string {
  return `data/workspaces/${tenantId}/agents/${agentId}`;
}

/**
 * Resolve the agent config file path.
 */
export function resolveAgentConfigPath(agentId: string, tenantId: string): string {
  return join(resolveAgentWorkspace(agentId, tenantId), 'agent.yaml');
}

/**
 * Load agent config from agent.yaml if it exists.
 * Returns null if the file doesn't exist.
 */
export function loadAgentConfig(agentId: string, tenantId: string): AgentConfig | null {
  const configPath = resolveAgentConfigPath(agentId, tenantId);
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content); // agent.yaml parsed as YAML → JSON object
    return AgentConfigSchema.parse(parsed);
  } catch {
    return null;
  }
}

// In-memory config cache (agentId → config)
const configCache = new Map<string, AgentConfig>();

/**
 * Get agent config with caching.
 * Loads from agent.yaml on first call, then caches in memory.
 */
export function resolveAgentConfig(agentId: string, tenantId: string): AgentConfig | null {
  const cacheKey = `${tenantId}:${agentId}`;
  if (configCache.has(cacheKey)) {
    return configCache.get(cacheKey)!;
  }
  const config = loadAgentConfig(agentId, tenantId);
  if (config) {
    configCache.set(cacheKey, config);
  }
  return config;
}

/**
 * Resolve which skills are available for a given agent.
 * Falls back to all discovered skills if no skills[] is specified in config.
 */
export function resolveAgentSkills(
  agentId: string,
  tenantId: string,
  allSkillIds: string[],
): string[] {
  const config = resolveAgentConfig(agentId, tenantId);
  if (!config) {
    return allSkillIds;
  }
  if (!config.skills || config.skills.length === 0) {
    return allSkillIds;
  }
  return config.skills.filter((s) => allSkillIds.includes(s));
}

/**
 * Resolve which tools are available for a given agent.
 * Falls back to all tool IDs if no tools[] is specified in config.
 */
export function resolveAgentTools(agentId: string, tenantId: string, allToolIds: string[]): string[] {
  const config = resolveAgentConfig(agentId, tenantId);
  if (!config) {
    return allToolIds;
  }
  if (!config.tools || config.tools.length === 0) {
    return allToolIds;
  }
  return config.tools.filter((t) => allToolIds.includes(t));
}

/** Clear the config cache (for testing) */
export function clearAgentConfigCache(): void {
  configCache.clear();
}

const DEFAULT_MODEL = 'openrouter/anthropic/claude-sonnet-4-6';

/**
 * Resolve the AI model for an agent by consulting registered provider plugins.
 *
 * Resolution order:
 * 1. Model from agent.yaml config (if set)
 * 2. Provider's resolveModel() hook (registered providers)
 * 3. Fallback chain: OpenRouter Sonnet → Haiku → GPT-4o-mini
 * 4. Hard default: openrouter/anthropic/claude-sonnet-4-6
 */
export function resolveAgentModel(
  agentId: string,
  tenantId: string,
  fallbackChain?: string[],
): string {
  // 1. Check agent.yaml config first
  const config = resolveAgentConfig(agentId, tenantId);
  if (config?.model) {
    return config.model;
  }

  // 2. Ask registered providers in order
  const manager = getPluginManager();
  const providers = manager.getProviders();
  const chain = fallbackChain ?? [DEFAULT_MODEL];

  for (const provider of providers) {
    if (provider.resolveModel) {
      const resolved = provider.resolveModel({ fallbackChain: chain });
      if (resolved) return resolved;
    }
  }

  // 3. Return first in fallback chain
  return chain[0] ?? DEFAULT_MODEL;
}