/**
 * @juragan/core
 *
 * Shared core types and utilities for Juragan.
 * Imported by both the API app and worker.
 */

export { getPluginManager } from './plugin-manager.js';
export type { DiscoveredPlugin, PluginApi } from './plugin-manager.js';
export {
  getAcpSessionManager,
  AcpSessionManager,
  type SessionHandle,
  type AgentInput,
  type AgentOutput,
  type DetachedTaskRun,
  type InitializeSessionParams,
  type SpawnParams,
} from './acp/manager.js';
