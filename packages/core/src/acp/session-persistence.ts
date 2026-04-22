/**
 * ACP Session Persistence — LibSQL-based ACP metadata + transcript storage.
 *
 * Provides:
 * - initAcpSchema(): creates acp_sessions + acp_transcripts tables
 * - upsertAcpSession(): insert or update session metadata
 * - getAcpSession(): retrieve session by key
 * - appendTranscript(): append a transcript entry (delta/done/error)
 * - listAcpSessionsByTenant(): list sessions for a tenant
 * - pruneOldSessions(): remove sessions older than maxAgeMs
 */

export interface AcpSessionRecord {
  sessionKey: string;
  tenantId: string;
  agentId: string;
  threadType: 'current' | 'child';
  parentSessionKey: string | null;
  status: 'active' | 'closed';
  createdAt: number;
  updatedAt: number;
  metadata: string | null;
}

export interface AcpTranscriptEntry {
  id: number;
  sessionKey: string;
  seq: number;
  type: 'delta' | 'done' | 'error';
  content: string | null;
  createdAt: number;
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS acp_sessions (
     session_key    TEXT NOT NULL PRIMARY KEY,
     tenant_id       TEXT NOT NULL,
     agent_id        TEXT NOT NULL,
     thread_type     TEXT NOT NULL CHECK (thread_type IN ('current','child')),
     parent_session_key TEXT,
     status          TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','closed')),
     created_at     INTEGER NOT NULL,
     updated_at      INTEGER NOT NULL,
     metadata        TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS acp_transcripts (
     id             INTEGER PRIMARY KEY AUTOINCREMENT,
     session_key    TEXT NOT NULL,
     seq            INTEGER NOT NULL,
     type           TEXT NOT NULL CHECK (type IN ('delta','done','error')),
     content        TEXT,
     created_at     INTEGER NOT NULL,
     UNIQUE (session_key, seq),
     FOREIGN KEY (session_key) REFERENCES acp_sessions(session_key)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_acp_sessions_tenant
     ON acp_sessions (tenant_id, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_acp_transcripts_session_seq
     ON acp_transcripts (session_key, seq)`,
];

export { DDL as acpSessionSchemaDDL };

/** Initialize ACP schema tables in the given DB */
export async function initAcpSchema(db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> }): Promise<void> {
  for (const sql of DDL) {
    await db.execute({ sql, args: [] });
  }
}

/** Upsert an ACP session record */
export async function upsertAcpSession(
  db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> },
  session: {
    sessionKey: string;
    tenantId: string;
    agentId: string;
    threadType: 'current' | 'child';
    parentSessionKey?: string | null;
    metadata?: string | null;
    status?: 'active' | 'closed';
    createdAt?: number;
  },
): Promise<void> {
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO acp_sessions (session_key, tenant_id, agent_id, thread_type, parent_session_key, status, created_at, updated_at, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(session_key) DO UPDATE SET
            agent_id = excluded.agent_id,
            thread_type = excluded.thread_type,
            parent_session_key = excluded.parent_session_key,
            status = excluded.status,
            updated_at = excluded.updated_at,
            metadata = excluded.metadata`,
    args: [
      session.sessionKey,
      session.tenantId,
      session.agentId,
      session.threadType,
      session.parentSessionKey ?? null,
      session.status ?? 'active',
      session.createdAt ?? now,
      now,
      session.metadata ?? null,
    ],
  });
}

/** Get a single ACP session by key */
export async function getAcpSession(
  db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> },
  sessionKey: string,
): Promise<AcpSessionRecord | null> {
  type Row = [string, string, string, string, string | null, string, number, number, string | null];
  const result = await db.execute({
    sql: 'SELECT session_key, tenant_id, agent_id, thread_type, parent_session_key, status, created_at, updated_at, metadata FROM acp_sessions WHERE session_key = ?',
    args: [sessionKey],
  });
  const rows = result as unknown as Row[][];
  const row = rows[0]?.[0];
  if (!row) return null;
  return {
    sessionKey: row[0],
    tenantId: row[1],
    agentId: row[2],
    threadType: row[3] as 'current' | 'child',
    parentSessionKey: row[4] ?? null,
    status: row[5] as 'active' | 'closed',
    createdAt: row[6],
    updatedAt: row[7],
    metadata: row[8] ?? null,
  };
}

/** Append a transcript entry */
export async function appendTranscript(
  db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> },
  opts: {
    sessionKey: string;
    type: 'delta' | 'done' | 'error';
    content?: string | null;
  },
): Promise<number> {
  const now = Date.now();
  // Get next seq
  const result = await db.execute({
    sql: 'SELECT COALESCE(MAX(seq), 0) + 1 FROM acp_transcripts WHERE session_key = ?',
    args: [opts.sessionKey],
  });
  const rows = result as unknown as number[][];
  const seq = rows[0]?.[0] ?? 1;
  await db.execute({
    sql: 'INSERT INTO acp_transcripts (session_key, seq, type, content, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [opts.sessionKey, seq, opts.type, opts.content ?? null, now],
  });
  return seq;
}

/** List sessions for a tenant */
export async function listAcpSessionsByTenant(
  db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> },
  tenantId: string,
  opts: { limit?: number; status?: 'active' | 'closed' } = {},
): Promise<AcpSessionRecord[]> {
  const limit = opts.limit ?? 50;
  const statusClause = opts.status ? `AND status = '${opts.status}'` : '';
  const result = await db.execute({
    sql: `SELECT session_key, tenant_id, agent_id, thread_type, parent_session_key, status, created_at, updated_at, metadata
          FROM acp_sessions WHERE tenant_id = ? ${statusClause}
          ORDER BY updated_at DESC LIMIT ?`,
    args: [tenantId, limit],
  });
  type Row = [string, string, string, string, string | null, string, number, number, string | null];
  const rows = result as unknown as Row[][];
  return (rows[0] ?? []).map((row) => ({
    sessionKey: row[0],
    tenantId: row[1],
    agentId: row[2],
    threadType: row[3] as 'current' | 'child',
    parentSessionKey: row[4] ?? null,
    status: row[5] as 'active' | 'closed',
    createdAt: row[6],
    updatedAt: row[7],
    metadata: row[8] ?? null,
  }));
}

/** Prune sessions older than maxAgeMs (default 7 days) */
export async function pruneOldSessions(
  db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> },
  maxAgeMs = 7 * 24 * 60 * 60 * 1000,
): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  // Delete transcripts first
  await db.execute({
    sql: `DELETE FROM acp_transcripts WHERE session_key IN
          (SELECT session_key FROM acp_sessions WHERE updated_at < ? AND status = 'closed')`,
    args: [cutoff],
  });
  const result = await db.execute({
    sql: 'DELETE FROM acp_sessions WHERE updated_at < ? AND status = ?',
    args: [cutoff, 'closed'],
  });
  return (result as unknown as { rowsAffected: number }).rowsAffected ?? 0;
}

/** Get full transcript for a session, ordered by seq */
export async function getTranscript(
  db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> },
  sessionKey: string,
): Promise<AcpTranscriptEntry[]> {
  const result = await db.execute({
    sql: 'SELECT id, session_key, seq, type, content, created_at FROM acp_transcripts WHERE session_key = ? ORDER BY seq ASC',
    args: [sessionKey],
  });
  type Row = [number, string, number, string, string | null, number];
  const rows = result as unknown as Row[][];
  return (rows[0] ?? []).map((row) => ({
    id: row[0],
    sessionKey: row[1],
    seq: row[2],
    type: row[3] as 'delta' | 'done' | 'error',
    content: row[4] ?? null,
    createdAt: row[5],
  }));
}

/**
 * Get a slice of transcript entries for a session.
 * Used for context window management — truncate old entries while preserving recent ones.
 *
 * @param sessionKey - the session to get transcript for
 * @param startSeq - starting sequence number (0 = oldest, default 0)
 * @param limit - max entries to return (default 100)
 * @returns transcript entries with seq numbers
 */
export async function getTranscriptSlice(
  db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> },
  sessionKey: string,
  opts: { startSeq?: number; limit?: number } = {},
): Promise<AcpTranscriptEntry[]> {
  const start = opts.startSeq ?? 0;
  const limit = opts.limit ?? 100;
  const result = await db.execute({
    sql: 'SELECT id, session_key, seq, type, content, created_at FROM acp_transcripts WHERE session_key = ? AND seq >= ? ORDER BY seq ASC LIMIT ?',
    args: [sessionKey, start, limit],
  });
  type Row = [number, string, number, string, string | null, number];
  const rows = result as unknown as Row[][];
  return (rows[0] ?? []).map((row) => ({
    id: row[0],
    sessionKey: row[1],
    seq: row[2],
    type: row[3] as 'delta' | 'done' | 'error',
    content: row[4] ?? null,
    createdAt: row[5],
  }));
}

/**
 * Summarize a transcript by collapsing consecutive delta entries into a single entry.
 * Used for truncating long transcripts before sending to the LLM.
 */
export function summarizeTranscript(
  entries: AcpTranscriptEntry[],
  maxEntries: number,
): AcpTranscriptEntry[] {
  if (entries.length <= maxEntries) return entries;

  // Keep first and last entries, collapse middle
  const kept: AcpTranscriptEntry[] = [];
  const skipped = entries.length - maxEntries;

  // Always keep first entry
  kept.push(entries[0]!);

  // Add a summary entry indicating truncation
  if (skipped > 0) {
    kept.push({
      id: -1,
      sessionKey: entries[0]!.sessionKey,
      seq: entries[0]!.seq + 1,
      type: 'done',
      content: `[${skipped} earlier entries truncated]`,
      createdAt: entries[0]!.createdAt,
    });
  }

  // Keep last entry
  kept.push(entries[entries.length - 1]!);

  return kept;
}