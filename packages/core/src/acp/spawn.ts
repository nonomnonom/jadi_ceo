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

/** Whether ACP subsystem is enabled */
function acpEnabled(): boolean {
  return process.env.ACP_ENABLED !== 'false';
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
    tenantId: valid.tenantId ?? 'default',
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
 * @param parentSessionKey - the session receiving the relayed output
 * @param childSessionKey  - the child session whose output is relayed
 * @param options.stallTimeout   - ms before calling onStall (default 60s)
 * @param options.lifetimeTimeout - ms before auto-close (default 6h)
 * @param options.onStall  - called when child produces no output for stallTimeout
 * @param options.onChildDone - called when child finishes or lifetime expires
 * @param options.onDelta  - called for each delta text relayed (optional)
 */
export async function startAcpSpawnParentStreamRelay(
  parentSessionKey: string,
  childSessionKey: string,
  options: {
    stallTimeout?: number;
    lifetimeTimeout?: number;
    onStall?: (childKey: string) => void;
    onChildDone?: (childKey: string) => void;
    onDelta?: (delta: string, parentKey: string) => void;
  } = {},
): Promise<{
  stop: () => void;
}> {
  const manager = getAcpSessionManager();
  const stallTimeout = options.stallTimeout ?? 60_000;
  const lifetimeTimeout = options.lifetimeTimeout ?? 6 * 60 * 60_000;

  let stalled = false;
  let stallTimer: ReturnType<typeof setTimeout>;
  let lifetimeTimer: ReturnType<typeof setTimeout>;

  const clearTimers = () => {
    clearTimeout(stallTimer);
    clearTimeout(lifetimeTimer);
  };

  const stop = () => {
    clearTimers();
    options.onChildDone?.(childSessionKey);
  };

  stallTimer = setTimeout(() => {
    stalled = true;
    options.onStall?.(childSessionKey);
  }, stallTimeout);

  lifetimeTimer = setTimeout(() => {
    stop();
    manager.closeSession({ sessionKey: childSessionKey, agentId: '', threadType: 'child', createdAt: 0 });
  }, lifetimeTimeout);

  // Drain the child generator and relay deltas to parent
  const childHandle = manager.getCachedSession(childSessionKey);
  if (childHandle) {
    const gen = await manager.runTurnWithTranscript(childHandle, {});
    for await (const event of gen) {
      if (stalled) {
        // Reset stall timer on activity
        stalled = false;
        stallTimer = setTimeout(() => {
          options.onStall?.(childSessionKey);
        }, stallTimeout);
      }
      if (event.type === 'delta' && event.delta) {
        options.onDelta?.(event.delta, parentSessionKey);
      }
      if (event.type === 'done' || event.type === 'error') {
        stop();
        break;
      }
    }
  } else {
    stop();
  }

  return { stop: () => clearTimers() };
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
