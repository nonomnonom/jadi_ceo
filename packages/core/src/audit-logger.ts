/**
 * Audit Logger — records all tool executions and approval events to the audit_logs table.
 *
 * Used by tool plugins and confirmation flows to maintain a complete audit trail.
 */

export type AuditAction = 'execute' | 'approve' | 'reject';
export type AuditActor = 'owner' | 'customer' | 'agent' | 'system';
export type AuditStatus = 'success' | 'error' | 'rejected' | 'timeout' | 'pending';
export type AuditChannel = 'telegram' | 'whatsapp' | 'api' | 'system';

export interface AuditLogEntry {
  toolId: string;
  toolName: string;
  action: AuditAction;
  actor: AuditActor;
  input?: unknown;
  result?: unknown;
  status: AuditStatus;
  channel: AuditChannel;
  conversationId?: string;
}

export interface AuditLogger {
  log(entry: AuditLogEntry): Promise<void>;
  query(params: {
    tenantId: string;
    toolId?: string;
    status?: AuditStatus;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogResult>;
}

export interface AuditLogRecord {
  id: number;
  toolId: string;
  toolName: string;
  action: AuditAction;
  actor: AuditActor;
  input: unknown | null;
  result: unknown | null;
  status: AuditStatus;
  channel: AuditChannel;
  conversationId: string | null;
  createdAt: number;
}

export interface AuditLogResult {
  records: AuditLogRecord[];
  total: number;
}

export function createAuditLogger(
  db: { execute: (op: { sql: string; args?: unknown[] }) => Promise<unknown> },
  tenantId: string,
): AuditLogger {
  async function log(entry: AuditLogEntry): Promise<void> {
    const now = Date.now();
    await db.execute({
      sql: `INSERT INTO audit_logs (tenant_id, tool_id, tool_name, action, actor, input_json, result_json, status, channel, conversation_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        tenantId,
        entry.toolId,
        entry.toolName,
        entry.action,
        entry.actor,
        entry.input != null ? JSON.stringify(entry.input) : null,
        entry.result != null ? JSON.stringify(entry.result) : null,
        entry.status,
        entry.channel,
        entry.conversationId ?? null,
        now,
      ],
    });
  }

  async function query(params: {
    tenantId: string;
    toolId?: string;
    status?: AuditStatus;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogResult> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const clauses = ['tenant_id = ?'];
    const args: unknown[] = [params.tenantId];

    if (params.toolId) {
      clauses.push('tool_id = ?');
      args.push(params.toolId);
    }
    if (params.status) {
      clauses.push('status = ?');
      args.push(params.status);
    }
    if (params.from) {
      clauses.push('created_at >= ?');
      args.push(params.from);
    }
    if (params.to) {
      clauses.push('created_at <= ?');
      args.push(params.to);
    }

    const where = clauses.join(' AND ');

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM audit_logs WHERE ${where}`,
      args,
    });
    const total = Number((countResult as unknown as { rows: { cnt: number }[] }).rows[0]?.cnt ?? 0);

    const rowsResult = await db.execute({
      sql: `SELECT id, tool_id, tool_name, action, actor, input_json, result_json, status, channel, conversation_id, created_at
            FROM audit_logs WHERE ${where}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });
    type Row = [number, string, string, string, string, string | null, string | null, string, string, string | null, number];
    const rows = (rowsResult as unknown as Row[][])[0] ?? [];

    const records: AuditLogRecord[] = rows.map((row) => ({
      id: row[0],
      toolId: row[1],
      toolName: row[2],
      action: row[3] as AuditAction,
      actor: row[4] as AuditActor,
      input: row[5] != null ? JSON.parse(row[5]) : null,
      result: row[6] != null ? JSON.parse(row[6]) : null,
      status: row[7] as AuditStatus,
      channel: row[8] as AuditChannel,
      conversationId: row[9] ?? null,
      createdAt: row[10],
    }));

    return { records, total };
  }

  return { log, query };
}