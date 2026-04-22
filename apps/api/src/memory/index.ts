import type { Db } from '../db/client.js';

export type MemoryType = 'note' | 'fact' | 'preference' | 'context';

export interface MemoryEntry {
  id: number;
  tenantId: string;
  type: MemoryType;
  content: string;
  importance: number;
  lastAccessedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryRecall {
  memoryId: number;
  recallCount: number;
  lastRecalledAt: number | null;
}

export function createMemoryStore({ db, tenantId }: { db: Db; tenantId: string }) {
  async function addMemory(
    type: MemoryType,
    content: string,
    importance: number = 1,
  ): Promise<number> {
    const now = Date.now();
    const result = await db.execute({
      sql: `INSERT INTO memory (tenant_id, type, content, importance, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [tenantId, type, content, importance, now, now],
    });
    return Number(result.lastInsertRowid);
  }

  async function getMemory(id: number): Promise<MemoryEntry | null> {
    const result = await db.execute({
      sql: `SELECT id, tenant_id, type, content, importance, last_accessed_at, created_at, updated_at
            FROM memory WHERE id = ? AND tenant_id = ?`,
      args: [id, tenantId],
    });
    if (result.rows.length === 0) return null;
    const r = result.rows[0]!;
    return {
      id: Number(r.id),
      tenantId: String(r.tenant_id),
      type: r.type as MemoryType,
      content: String(r.content),
      importance: Number(r.importance),
      lastAccessedAt: r.last_accessed_at != null ? Number(r.last_accessed_at) : null,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };
  }

  async function searchMemory(query: string, limit: number = 10): Promise<MemoryEntry[]> {
    const result = await db.execute({
      sql: `SELECT id, tenant_id, type, content, importance, last_accessed_at, created_at, updated_at
            FROM memory
            WHERE tenant_id = ? AND content LIKE ?
            ORDER BY importance DESC, updated_at DESC
            LIMIT ?`,
      args: [tenantId, `%${query}%`, limit],
    });
    return result.rows.map((r) => ({
      id: Number(r.id),
      tenantId: String(r.tenant_id),
      type: r.type as MemoryType,
      content: String(r.content),
      importance: Number(r.importance),
      lastAccessedAt: r.last_accessed_at != null ? Number(r.last_accessed_at) : null,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    }));
  }

  async function updateMemory(
    id: number,
    updates: Partial<Pick<MemoryEntry, 'content' | 'importance' | 'type'>>,
  ): Promise<boolean> {
    const fields: string[] = [];
    const args: (string | number)[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      args.push(updates.content);
    }
    if (updates.importance !== undefined) {
      fields.push('importance = ?');
      args.push(updates.importance);
    }
    if (updates.type !== undefined) {
      fields.push('type = ?');
      args.push(updates.type);
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    args.push(Date.now());
    args.push(id, tenantId);

    const result = await db.execute({
      sql: `UPDATE memory SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      args,
    });
    return (result.rowsAffected ?? 0) > 0;
  }

  async function deleteMemory(id: number): Promise<boolean> {
    const result = await db.execute({
      sql: `DELETE FROM memory WHERE id = ? AND tenant_id = ?`,
      args: [id, tenantId],
    });
    return (result.rowsAffected ?? 0) > 0;
  }

  async function getRecentNotes(limit: number = 20): Promise<MemoryEntry[]> {
    const result = await db.execute({
      sql: `SELECT id, tenant_id, type, content, importance, last_accessed_at, created_at, updated_at
            FROM memory
            WHERE tenant_id = ?
            ORDER BY updated_at DESC
            LIMIT ?`,
      args: [tenantId, limit],
    });
    return result.rows.map((r) => ({
      id: Number(r.id),
      tenantId: String(r.tenant_id),
      type: r.type as MemoryType,
      content: String(r.content),
      importance: Number(r.importance),
      lastAccessedAt: r.last_accessed_at != null ? Number(r.last_accessed_at) : null,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    }));
  }

  async function getMemoryStats(): Promise<{
    total: number;
    byType: Record<MemoryType, number>;
    byImportance: Record<number, number>;
  }> {
    const typeResult = await db.execute({
      sql: `SELECT type, COUNT(*) as cnt FROM memory WHERE tenant_id = ? GROUP BY type`,
      args: [tenantId],
    });
    const byType: Record<string, number> = { note: 0, fact: 0, preference: 0, context: 0 };
    for (const row of typeResult.rows) {
      byType[String(row.type)] = Number(row.cnt);
    }

    const totalResult = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM memory WHERE tenant_id = ?`,
      args: [tenantId],
    });
    const total = Number(totalResult.rows[0]?.cnt ?? 0);

    const impResult = await db.execute({
      sql: `SELECT importance, COUNT(*) as cnt FROM memory WHERE tenant_id = ? GROUP BY importance`,
      args: [tenantId],
    });
    const byImportance: Record<number, number> = {};
    for (const row of impResult.rows) {
      byImportance[Number(row.importance)] = Number(row.cnt);
    }

    return { total, byType: byType as Record<MemoryType, number>, byImportance };
  }

  return {
    addMemory,
    getMemory,
    searchMemory,
    updateMemory,
    deleteMemory,
    getRecentNotes,
    getMemoryStats,
  };
}
