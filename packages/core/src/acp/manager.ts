/**
 * ACP Session Manager — OpenClaw-style supervisor pattern for Juragan.
 *
 * Provides:
 * - Actor-model serialized access per session key via SessionActorQueue
 * - In-memory runtime cache with TTL-based idle eviction
 * - Session lifecycle: initializeSession → runTurn → closeSession
 * - Detached task tracking for spawned sub-agent sessions
 *
 * This is the foundation for proper multi-agent orchestration where the
 * supervisor can spawn, track, and coordinate sub-agents with stream relay.
 */

import { z } from 'zod';
import { upsertAcpSession, appendTranscript } from './session-persistence.js';

// Re-export shared types from plugin-sdk for convenience
export type { ToolDefinition, ToolContext } from '@juragan/plugin-sdk';
export { z };

/** Session handle returned by initializeSession — used for runTurn and closeSession */
export interface SessionHandle {
  sessionKey: string;
  agentId: string;
  threadType: 'current' | 'child';
  parentSessionKey?: string;
  createdAt: number;
}

/** Input to a single turn of the agent */
export interface AgentInput {
  text?: string;
  context?: Record<string, unknown>;
}

/** Output event from a turn */
export interface AgentOutput {
  type: 'delta' | 'done' | 'error';
  delta?: string;
  text?: string;
  error?: string;
}

/** Signature of an agent executor — wires ACP to a real Mastra agent */
export type AgentExecutor = (
  agentId: string,
  input: AgentInput,
) => Promise<AsyncGenerator<AgentOutput>>;

/** Parameters for initializing a new session */
export const InitializeSessionSchema = z.object({
  sessionKey: z.string().min(1),
  agentId: z.string().min(1).default('owner-supervisor'),
  threadType: z.enum(['current', 'child']).default('current'),
  parentSessionKey: z.string().optional(),
  workspacePath: z.string().optional(),
  tenantId: z.string().min(1).default('default'),
});
export type InitializeSessionParams = z.infer<typeof InitializeSessionSchema>;

/** A running task that was spawned and detached from the parent session */
export interface DetachedTaskRun {
  id: string;
  label: string;
  sessionKey: string;
  agentId: string;
  createdAt: number;
  status: 'running' | 'done' | 'failed';
  result?: unknown;
}

/** Parameters for spawning a detached task */
export const SpawnParamsSchema = z.object({
  task: z.string().min(1),
  label: z.string().optional(),
  agentId: z.string().min(1).optional(),
  resumeSessionKey: z.string().optional(),
  threadType: z.enum(['current', 'child']).default('child'),
  streamTo: z.string().optional(),
  tenantId: z.string().min(1).optional(),
  parentSessionKey: z.string().optional(),
});
export type SpawnParams = z.infer<typeof SpawnParamsSchema>;

/** Queue entry for actor-model serialization */
type QueuedOp<T> = () => Promise<T>;

class SessionActorQueue {
  private queue: QueuedOp<unknown>[] = [];
  private running = false;

  constructor(_sessionKey: string) {}

  async enqueue<T>(op: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await op());
        } catch (e) {
          reject(e);
        }
      });
      this.drain();
    });
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const op = this.queue.shift()!;
      // eslint-disable-next-line no-empty
      try { await op(); } catch {}
    }
    this.running = false;
  }
}

interface CachedRuntime {
  handle: SessionHandle;
  lastAccess: number;
}

class RuntimeCache {
  private cache = new Map<string, CachedRuntime>();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(ttl = 30 * 60 * 1000, maxSize = 100) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  get(sessionKey: string): CachedRuntime | undefined {
    const entry = this.cache.get(sessionKey);
    if (!entry) return undefined;
    if (Date.now() - entry.lastAccess > this.ttl) {
      this.evict(sessionKey);
      return undefined;
    }
    entry.lastAccess = Date.now();
    return entry;
  }

  set(sessionKey: string, handle: SessionHandle): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(sessionKey, { handle, lastAccess: Date.now() });
  }

  has(sessionKey: string): boolean {
    return this.get(sessionKey) !== undefined;
  }

  evict(sessionKey: string) {
    this.cache.delete(sessionKey);
  }

  private evictLRU() {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldest = key;
      }
    }
    if (oldest) this.evict(oldest);
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * ACP Session Manager — singleton coordinating session lifecycle.
 *
 * Key design:
 * - Actor model: each sessionKey has its own Queue serializing all operations
 * - Runtime cache: active sessions kept warm with TTL-based eviction
 * - Detached tasks: tracked independently with status + result
 */
class AcpSessionManager {
  private static instance: AcpSessionManager;

  private sessionQueues = new Map<string, SessionActorQueue>();
  private runtimeCache = new RuntimeCache();
  private detachedTasks = new Map<string, DetachedTaskRun[]>();
  private db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> } | null = null;
  private executor: AgentExecutor | null = null;

  static getInstance(): AcpSessionManager {
    if (!AcpSessionManager.instance) {
      AcpSessionManager.instance = new AcpSessionManager();
    }
    return AcpSessionManager.instance;
  }

  /** Wire a LibSQL db instance for persistence (call once at startup) */
  setDb(db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> }): void {
    this.db = db;
  }

  /** Wire an agent executor — called by the API layer to connect ACP to Mastra agents */
  setExecutor(executor: AgentExecutor): void {
    this.executor = executor;
  }

  private getOrCreateQueue(sessionKey: string): SessionActorQueue {
    if (!this.sessionQueues.has(sessionKey)) {
      this.sessionQueues.set(sessionKey, new SessionActorQueue(sessionKey));
    }
    return this.sessionQueues.get(sessionKey)!;
  }

  async initializeSession(params: InitializeSessionParams): Promise<SessionHandle> {
    const valid = InitializeSessionSchema.parse(params);
    const queue = this.getOrCreateQueue(valid.sessionKey);

    return queue.enqueue<SessionHandle>(async () => {
      const handle: SessionHandle = {
        sessionKey: valid.sessionKey,
        agentId: valid.agentId,
        threadType: valid.threadType,
        parentSessionKey: valid.parentSessionKey,
        createdAt: Date.now(),
      };
      this.runtimeCache.set(valid.sessionKey, handle);
      // Persist session to LibSQL if db is wired
      if (this.db) {
        await upsertAcpSession(this.db, {
          sessionKey: valid.sessionKey,
          tenantId: valid.tenantId,
          agentId: valid.agentId,
          threadType: valid.threadType,
          parentSessionKey: valid.parentSessionKey,
        });
      }
      return handle;
    });
  }

  async runTurn(
    handle: SessionHandle,
    input: AgentInput,
  ): Promise<AsyncGenerator<AgentOutput>> {
    if (this.executor) {
      return this.executor(handle.agentId, input);
    }
    async function* generate(): AsyncGenerator<AgentOutput> {
      yield { type: 'done', text: '' };
    }
    return generate();
  }

  async runTurnWithTranscript(
    handle: SessionHandle,
    input: AgentInput,
  ): Promise<AsyncGenerator<AgentOutput>> {
    const db = this.db;

    // If an executor is wired, use it to run the actual Mastra agent
    if (this.executor) {
      const gen = await this.executor(handle.agentId, input);
      const dbForAppend = db;
      const sessionKey = handle.sessionKey;

      async function* generateWithExecutor(): AsyncGenerator<AgentOutput> {
        try {
          for await (const event of gen) {
            // The executor already yields typed AgentOutput events.
            // Just pass them through while appending to transcript for audit.
            if (dbForAppend && (event.type === 'delta' || event.type === 'done' || event.type === 'error')) {
              await appendTranscript(dbForAppend, {
                sessionKey,
                type: event.type,
                content: event.type === 'delta' ? event.delta : event.type === 'error' ? event.error : null,
              });
            }
            yield event;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (dbForAppend) {
            await appendTranscript(dbForAppend, { sessionKey, type: 'error', content: errorMsg });
          }
          yield { type: 'error', error: errorMsg };
        }
      }
      return generateWithExecutor();
    }

    // Fallback: placeholder when no executor is wired
    async function* generate(): AsyncGenerator<AgentOutput> {
      if (input.text) {
        if (db) await appendTranscript(db, { sessionKey: handle.sessionKey, type: 'delta', content: input.text });
        yield { type: 'delta', delta: input.text };
      }
      if (db) await appendTranscript(db, { sessionKey: handle.sessionKey, type: 'done', content: '' });
      yield { type: 'done', text: '' };
    }
    return generate();
  }

  async closeSession(handle: SessionHandle): Promise<void> {
    this.runtimeCache.evict(handle.sessionKey);
    if (this.db) {
      await upsertAcpSession(this.db, {
        sessionKey: handle.sessionKey,
        tenantId: 'default',
        agentId: handle.agentId,
        threadType: handle.threadType,
        parentSessionKey: handle.parentSessionKey,
        status: 'closed',
      });
    }
  }

  getCachedSession(sessionKey: string): SessionHandle | undefined {
    return this.runtimeCache.get(sessionKey)?.handle;
  }

  /** List running detached tasks for an owner key */
  getRunningTaskRuns(ownerKey = 'default'): DetachedTaskRun[] {
    return this.detachedTasks.get(ownerKey) ?? [];
  }

  /** Count running detached tasks for an owner key (no iteration) */
  getRunningTaskCount(ownerKey = 'default'): number {
    return this.detachedTasks.get(ownerKey)?.filter((t) => t.status === 'running').length ?? 0;
  }

  /** Create and track a new detached task run */
  createRunningTaskRun(params: SpawnParams): DetachedTaskRun {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const task: DetachedTaskRun = {
      id,
      label: params.label ?? params.task.slice(0, 50),
      sessionKey: params.resumeSessionKey ?? id,
      agentId: params.agentId ?? 'owner-supervisor',
      createdAt: Date.now(),
      status: 'running',
    };
    const ownerKey = 'default';
    if (!this.detachedTasks.has(ownerKey)) {
      this.detachedTasks.set(ownerKey, []);
    }
    this.detachedTasks.get(ownerKey)!.push(task);
    return task;
  }

  /** Mark a detached task as done with an optional result */
  completeTaskRun(id: string, result?: unknown): void {
    for (const tasks of this.detachedTasks.values()) {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        task.status = 'done';
        task.result = result;
        break;
      }
    }
  }

  /** Mark a detached task as failed with an optional error */
  failTaskRun(id: string, error?: unknown): void {
    for (const tasks of this.detachedTasks.values()) {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        task.status = 'failed';
        task.result = error;
        break;
      }
    }
  }

  /** List ACP sessions from DB (requires setDb to be called first) */
  async listSessions(tenantId: string, limit = 50): Promise<unknown[]> {
    if (!this.db) return [];
    const { listAcpSessionsByTenant } = await import('./session-persistence.js');
    const sessions = await listAcpSessionsByTenant(
      this.db as Parameters<typeof listAcpSessionsByTenant>[0],
      tenantId,
      { limit },
    );
    return sessions as unknown[];
  }

  /** Reset for testing — not for production use */
  reset(): void {
    this.sessionQueues.clear();
    this.runtimeCache.clear();
    this.detachedTasks.clear();
  }
}

export { AcpSessionManager };
export const getAcpSessionManager = AcpSessionManager.getInstance;
