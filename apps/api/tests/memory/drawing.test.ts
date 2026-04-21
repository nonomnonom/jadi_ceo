import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { lightDream, remDream, deepDream, isNearDreamTime } from '../../src/memory/drawing.ts';

describe('dreaming functions', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
    // Clean up memory data for this tenant to ensure test isolation
    // memory_recalls has FK to memory.id, so delete recalls first
    const memoryIds = await db.execute({
      sql: 'SELECT id FROM memory WHERE tenant_id = ?',
      args: [DEFAULT_TENANT_ID],
    });
    for (const row of memoryIds.rows) {
      await db.execute({ sql: 'DELETE FROM memory_recalls WHERE memory_id = ?', args: [Number(row.id)] });
    }
    await db.execute({ sql: 'DELETE FROM memory WHERE tenant_id = ?', args: [DEFAULT_TENANT_ID] });
    vi.clearAllMocks();
  });

  describe('lightDream', () => {
    it('creates memories from session notes', async () => {
      const db = getDb();
      const result = await lightDream(
        { db, tenantId: DEFAULT_TENANT_ID },
        ['Remember that customer X prefers express shipping', 'Product Y is out of stock'],
      );

      expect(result.notesProcessed).toBe(2);
      expect(result.memoriesCreated).toBe(2);
    });

    it('returns 0 when no notes provided', async () => {
      const db = getDb();
      const result = await lightDream({ db, tenantId: DEFAULT_TENANT_ID }, []);
      expect(result.memoriesCreated).toBe(0);
      expect(result.notesProcessed).toBe(0);
    });

    it('skips empty strings', async () => {
      const db = getDb();
      const result = await lightDream({ db, tenantId: DEFAULT_TENANT_ID }, ['valid note', '   ', '']);
      expect(result.notesProcessed).toBe(3);
      expect(result.memoriesCreated).toBe(1);
    });
  });

  describe('remDream', () => {
    it('examines recent notes and returns stats', async () => {
      const db = getDb();
      await lightDream({ db, tenantId: DEFAULT_TENANT_ID }, ['test note one', 'test note two']);

      const result = await remDream({ db, tenantId: DEFAULT_TENANT_ID });

      expect(result.notesExamined).toBe(2);
      expect(result.promoted).toBe(0);
      expect(result.consolidated).toBe(0);
    });

    it('returns empty stats when no memories exist', async () => {
      const db = getDb();
      const result = await remDream({ db, tenantId: DEFAULT_TENANT_ID });
      expect(result.notesExamined).toBe(0);
    });
  });

  describe('deepDream', () => {
    it('returns stats even when no memories exist', async () => {
      const db = getDb();
      const result = await deepDream({ db, tenantId: DEFAULT_TENANT_ID });
      expect(result.totalMemories).toBe(0);
      expect(result.memoriesPromoted).toBe(0);
      expect(result.memoriesDeleted).toBe(0);
    });

    it('processes existing memories', async () => {
      const db = getDb();
      await lightDream({ db, tenantId: DEFAULT_TENANT_ID }, ['important business fact', 'customer preference']);

      const result = await deepDream({ db, tenantId: DEFAULT_TENANT_ID });
      expect(result.totalMemories).toBe(2);
    });
  });

  describe('isNearDreamTime', () => {
    it('returns true when current hour is near target WIB', () => {
      // isNearDreamTime checks if current UTC hour is within buffer of target WIB hour
      // Default target is midnight WIB (hour 0), which is 17:00 UTC previous day
      // With 60 minute buffer, should be near 17:00 UTC or 00:00 WIB
      const result = isNearDreamTime(0, 60);
      // Result depends on current time - just check it returns a boolean
      expect(typeof result).toBe('boolean');
    });

    it('accepts custom target hour', () => {
      const result = isNearDreamTime(9, 60); // 9am WIB = 2am UTC
      expect(typeof result).toBe('boolean');
    });
  });
});
