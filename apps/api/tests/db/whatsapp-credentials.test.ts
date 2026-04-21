import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';

describe('whatsapp_credentials table', () => {
  beforeAll(async () => {
    const db = getDb();
    await initSchema(db);
  });

  it('creates whatsapp_credentials table', async () => {
    const db = getDb();
    const result = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='whatsapp_credentials'"
    );
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('has tenant_id, device_name, auth_state columns', async () => {
    const db = getDb();
    const info = await db.execute('PRAGMA table_info(whatsapp_credentials)');
    const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
    expect(columns).toContain('tenant_id');
    expect(columns).toContain('device_name');
    expect(columns).toContain('auth_state');
  });
});
