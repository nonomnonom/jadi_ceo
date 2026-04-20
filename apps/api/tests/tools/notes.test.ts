import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { createNoteTools } from '../../src/mastra/tools/notes.js';
import { runTool } from '../run-tool.js';

const TENANT = 'test-tenant';

let db: Db;
let tools: ReturnType<typeof createNoteTools>;

beforeEach(async () => {
  db = createDb(':memory:');
  await initSchema(db);
  tools = createNoteTools({ db, tenantId: TENANT });
});

describe('addNote', () => {
  it('stores a note and returns its id + createdAt', async () => {
    const before = Date.now();
    const result = await runTool(tools.addNote, {
      content: 'Supplier X minta DP 30%',
      category: 'supplier',
    });
    expect(result.id).toBeGreaterThan(0);
    expect(result.content).toBe('Supplier X minta DP 30%');
    expect(result.category).toBe('supplier');
    expect(result.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('stores a note without category as null', async () => {
    const result = await runTool(tools.addNote, { content: 'Ide produk: sabun kopi' });
    expect(result.category).toBeNull();
  });
});

describe('listNotes', () => {
  it('returns recent notes newest-first', async () => {
    await runTool(tools.addNote, { content: 'pertama' });
    await new Promise((r) => setTimeout(r, 5));
    await runTool(tools.addNote, { content: 'kedua' });
    const { notes } = await runTool(tools.listNotes, { limit: 10 });
    expect(notes).toHaveLength(2);
    expect(notes[0]?.content).toBe('kedua');
    expect(notes[1]?.content).toBe('pertama');
  });

  it('honors limit', async () => {
    for (const c of ['a', 'b', 'c', 'd']) {
      await runTool(tools.addNote, { content: c });
    }
    const { notes } = await runTool(tools.listNotes, { limit: 2 });
    expect(notes).toHaveLength(2);
  });

  it('filters by category', async () => {
    await runTool(tools.addNote, { content: 'supplier note', category: 'supplier' });
    await runTool(tools.addNote, { content: 'random note' });
    const { notes } = await runTool(tools.listNotes, { limit: 10, category: 'supplier' });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toBe('supplier note');
  });

  it('scopes by tenantId (other tenant cannot see)', async () => {
    await runTool(tools.addNote, { content: 'milik-tenant-A' });
    const otherTools = createNoteTools({ db, tenantId: 'tenant-B' });
    const { notes } = await runTool(otherTools.listNotes, { limit: 10 });
    expect(notes).toHaveLength(0);
  });
});
