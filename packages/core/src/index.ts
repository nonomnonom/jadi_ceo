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
export {
  spawnAcpDirect,
  startAcpSpawnParentStreamRelay,
  prepareAcpThreadBinding,
  type SpawnAcpResult,
} from './acp/spawn.js';
export {
  AgentConfigSchema,
  resolveAgentWorkspace,
  resolveAgentConfigPath,
  loadAgentConfig,
  resolveAgentConfig,
  resolveAgentSkills,
  resolveAgentTools,
  resolveAgentModel,
  clearAgentConfigCache,
  type AgentConfig,
} from './acp/agent-config.js';
export {
  initAcpSchema,
  upsertAcpSession,
  getAcpSession,
  appendTranscript,
  getTranscript,
  getTranscriptSlice,
  summarizeTranscript,
  listAcpSessionsByTenant,
  pruneOldSessions,
  acpSessionSchemaDDL,
  type AcpSessionRecord,
  type AcpTranscriptEntry,
} from './acp/session-persistence.js';
export {
  createAuditLogger,
  type AuditLogEntry,
  type AuditLogger,
  type AuditLogRecord,
  type AuditLogResult,
  type AuditAction,
  type AuditActor,
  type AuditStatus,
  type AuditChannel,
} from './audit-logger.js';
export {
  getConfirmationRegistry,
  resetConfirmationRegistry,
  type PendingApproval,
  type ApprovalResult,
  type ApprovalHandler,
  type ConfirmationRegistry,
} from './confirmation-registry.js';
export {
  getWorkflowEventBus,
  resetWorkflowEventBus,
  emitWorkflowEvent,
  type WorkflowEvent,
  type WorkflowEventType,
  type EventHandler,
} from './workflow/event-bus.js';
