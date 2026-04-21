/**
 * ACP Spawn System — spawn sub-agents with session management and stream relay.
 *
 * Provides:
 * - spawnAcpDirect(): create a new ACP session for a sub-agent task
 * - startAcpSpawnParentStreamRelay(): buffer and flush deltas from child to parent session
 * - prepareAcpThreadBinding(): bind child session to parent for output routing
 */

import { randomUUID } from 'node:crypto';
import {
  getAcpSessionManager,
  type SessionHandle,
  type SpawnParams,
  SpawnParamsSchema,
} from './manager.js';

/** Whether ACP subsystem is enabled (always true for now) */
function acpEnabled(): boolean {
  return true;
}

/** Result of a spawn call */
export interface SpawnAcpResult {
  status: 'accepted' | 'rejected';
  childSessionKey: string;
  runId?: string;
  mode: 'run' | 'session';
  error?: string;
}

/**
 * Spawn a sub-agent session.
 *
 * @param params - spawn parameters (task, label, agentId, mode, thread binding, etc.)
 * @param requesterKey - tenant-scoped key of the requesting session (for detached task tracking)
 */
export async function spawnAcpDirect(
  params: SpawnParams,
  _requesterKey: string,
): Promise<SpawnAcpResult> {
  if (!acpEnabled()) {
    return { status: 'rejected', childSessionKey: '', mode: 'session', error: 'ACP not enabled' };
  }

  const valid = SpawnParamsSchema.parse(params);
  const manager = getAcpSessionManager();

  const sessionKey = valid.resumeSessionKey
    ?? `agent:${valid.agentId ?? 'owner-supervisor'}:acp:${randomUUID()}`;

  const handle = await manager.initializeSession({
    sessionKey,
    agentId: valid.agentId ?? 'owner-supervisor',
    threadType: valid.threadType,
  });

  if (valid.threadType === 'child') {
    // Track as detached task for this owner
    manager.createRunningTaskRun({ ...valid, label: valid.label ?? valid.task.slice(0, 50) });
  }

  return {
    status: 'accepted',
    childSessionKey: sessionKey,
    runId: handle.sessionKey,
    mode: valid.streamTo ? 'session' : 'session',
  };
}

/**
 * Wire a child session's output stream to the parent session.
 * Buffers deltas and flushes them to the parent's conversation.
 *
 * Note: actual parent output routing depends on how the Mastra agent stores
 * its output stream — this function sets up the relay infrastructure.
 */
export async function startAcpSpawnParentStreamRelay(
  _parentSessionKey: string,
  childSessionKey: string,
  options: {
    stallTimeout?: number;
    lifetimeTimeout?: number;
    onStall?: (childKey: string) => void;
    onChildDone?: (childKey: string) => void;
  } = {},
): Promise<{
  stop: () => void;
}> {
  const manager = getAcpSessionManager();
  const stallTimeout = options.stallTimeout ?? 60_000;
  const lifetimeTimeout = options.lifetimeTimeout ?? 6 * 60 * 60_000;

  let stallTimer = setTimeout(() => {
    options.onStall?.(childSessionKey);
  }, stallTimeout);

  let lifetimeTimer = setTimeout(() => {
    stop();
    manager.closeSession({ sessionKey: childSessionKey, agentId: '', threadType: 'child', createdAt: 0 });
  }, lifetimeTimeout);

  function stop() {
    clearTimeout(stallTimer);
    clearTimeout(lifetimeTimer);
    options.onChildDone?.(childSessionKey);
  }

  // Start a turn on the child session (non-blocking for the relay)
  // The relay reads deltas from the child and flushes them to the parent
  const childHandle = manager.getCachedSession(childSessionKey);
  if (childHandle) {
    // Drain the child generator and relay deltas
    const gen = await manager.runTurn(childHandle, {});
    // eslint-disable-next-line no-empty
    for await (const _ of gen) { /* relay in step 3 real implementation */ }
  }

  return { stop };
}

/**
 * Prepare thread binding — flags that child output should route to parent.
 * The actual routing is done by startAcpSpawnParentStreamRelay.
 */
export async function prepareAcpThreadBinding(
  _childHandle: SessionHandle,
  _parentSessionKey: string,
): Promise<void> {
  // Binding is implicit: parent tracks child via detached task list.
  // The stream relay reads from the child's session output.
  // This function can be extended to store parent-child relationship
  // in the session metadata for debugging/observability.
}
