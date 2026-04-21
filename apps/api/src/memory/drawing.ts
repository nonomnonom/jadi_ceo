import type { Db } from '../db/client.js';
import { createMemoryStore } from './index.js';

export interface DreamConfig {
  enabled: boolean;
  lightDreamAfterSession: boolean;
  remDreamIntervalMinutes: number;
  deepDreamHourWib: number;
}

export const DEFAULT_DREAM_CONFIG: DreamConfig = {
  enabled: true,
  lightDreamAfterSession: true,
  remDreamIntervalMinutes: 60,
  deepDreamHourWib: 0, // midnight WIB
};

interface SessionNote {
  id: number;
  content: string;
  created_at: number;
}

/**
 * Light Dream — process session notes into memory after each conversation.
 * Called at the end of each session or after significant interactions.
 */
export async function lightDream(
  { db, tenantId }: { db: Db; tenantId: string },
  sessionNotes: string[],
): Promise<{ memoriesCreated: number; notesProcessed: number }> {
  if (!sessionNotes.length) return { memoriesCreated: 0, notesProcessed: 0 };

  const store = createMemoryStore({ db, tenantId });
  let memoriesCreated = 0;

  for (const note of sessionNotes) {
    const trimmed = note.trim();
    if (!trimmed) continue;

    // Determine type based on content keywords
    let type: 'note' | 'fact' | 'preference' | 'context' = 'note';
    const lower = trimmed.toLowerCase();

    if (/\b(prefer|selalu|mau|enggak|不对|wrong|right)\b/.test(lower)) {
      type = 'preference';
    } else if (/\b(fact|fakta|real|sebenarnya|actually)\b/.test(lower)) {
      type = 'fact';
    } else if (/\b(context|konteks|situasi|condition|circumstance)\b/.test(lower)) {
      type = 'context';
    }

    // Importance based on length and detail
    const importance = trimmed.length > 100 ? 3 : trimmed.length > 50 ? 2 : 1;

    await store.addMemory(type, trimmed, importance);
    memoriesCreated++;
  }

  return { memoriesCreated, notesProcessed: sessionNotes.length };
}

/**
 * REM Dream — hourly consolidation of session corpus.
 * Looks at recent notes and promotes important ones or consolidates similar entries.
 */
export async function remDream(
  { db, tenantId }: { db: Db; tenantId: string },
  options?: { consolidateSimilar?: boolean; promoteThreshold?: number },
): Promise<{ notesExamined: number; promoted: number; consolidated: number }> {
  const store = createMemoryStore({ db, tenantId });
  const recent = await store.getRecentNotes(50);

  let promoted = 0;
  let consolidated = 0;

  // Promote high-importance notes that haven't been accessed recently
  const staleHighValue = recent.filter(
    (m) =>
      m.importance >= 3 &&
      (m.lastAccessedAt === null || Date.now() - m.lastAccessedAt > 7 * 24 * 60 * 60 * 1000),
  );
  for (const m of staleHighValue) {
    await store.updateMemory(m.id, { importance: Math.min(m.importance + 1, 5) });
    promoted++;
  }

  if (options?.consolidateSimilar) {
    // Group by similarity (simple: same first 50 chars)
    const groups: Record<string, typeof recent> = {};
    for (const m of recent) {
      const key = m.content.slice(0, 50).toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    for (const [, group] of Object.entries(groups)) {
      if (group.length > 1) {
        // Keep the most important, update others to note type and lower importance
        const sorted = group.sort((a, b) => b.importance - a.importance);
        for (let i = 1; i < sorted.length; i++) {
          await store.updateMemory(sorted[i].id, {
            type: 'note',
            importance: Math.max(1, sorted[i].importance - 1),
          });
          consolidated++;
        }
      }
    }
  }

  return { notesExamined: recent.length, promoted, consolidated };
}

/**
 * Deep Dream — daily midnight WIB promotion of valuable memories.
 * Also cleans up low-value stale memories.
 */
export async function deepDream(
  { db, tenantId }: { db: Db; tenantId: string },
  options?: { promoteThreshold?: number; deleteThreshold?: number },
): Promise<{
  memoriesPromoted: number;
  memoriesDeleted: number;
  totalMemories: number;
}> {
  const store = createMemoryStore({ db, tenantId });
  const stats = await store.getMemoryStats();
  const promoteThreshold = options?.promoteThreshold ?? 3;
  const deleteThreshold = options?.deleteThreshold ?? 1;

  // Find memories that should be promoted to higher importance
  const allMemories = await db.execute({
    sql: `SELECT id, content, importance, last_accessed_at, recall_count
          FROM memory m
          LEFT JOIN memory_recalls r ON m.id = r.memory_id
          WHERE tenant_id = ?`,
    args: [tenantId],
  });

  let memoriesPromoted = 0;
  let memoriesDeleted = 0;

  for (const row of allMemories.rows) {
    const recallCount = Number(row.recall_count ?? 0);
    const lastAccessed = row.last_accessed_at != null ? Number(row.last_accessed_at) : null;
    const age = lastAccessed ? Date.now() - lastAccessed : 0;

    // Promote if high recall count but low importance
    if (recallCount >= 5 && Number(row.importance) < promoteThreshold) {
      await store.updateMemory(Number(row.id), {
        importance: Math.min(Number(row.importance) + 1, 5),
      });
      memoriesPromoted++;
    }

    // Delete if very low importance and never accessed in 30 days
    if (
      Number(row.importance) <= deleteThreshold &&
      recallCount === 0 &&
      age > 30 * 24 * 60 * 60 * 1000
    ) {
      await store.deleteMemory(Number(row.id));
      memoriesDeleted++;
    }
  }

  const newStats = await store.getMemoryStats();
  return {
    memoriesPromoted,
    memoriesDeleted,
    totalMemories: newStats.total,
  };
}

/**
 * Check if current hour is within the deep dream window (around midnight WIB).
 * WIB is UTC+7, so midnight WIB = 17:00 UTC previous day or 17:00 UTC current day.
 * We check if we're within 1 hour of the target hour.
 */
export function isNearDreamTime(targetHourWib: number = 0, bufferMinutes: number = 60): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();

  // Convert WIB target to UTC
  const targetUtcHour = targetHourWib - 7;
  const adjustedTarget = targetUtcHour < 0 ? targetUtcHour + 24 : targetUtcHour;

  const currentMinutes = utcHour * 60 + utcMinute;
  const targetMinutes = adjustedTarget * 60;
  const diff = Math.abs(currentMinutes - targetMinutes);

  return diff <= bufferMinutes || diff >= 24 * 60 - bufferMinutes;
}
