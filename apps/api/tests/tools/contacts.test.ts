import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { createContactTools } from '../../src/mastra/tools/contacts.js';
import { runTool } from '../run-tool.js';

const TENANT = 'test-tenant';

let db: Db;
let tools: ReturnType<typeof createContactTools>;

beforeEach(async () => {
  db = createDb(':memory:');
  await initSchema(db);
  tools = createContactTools({ db, tenantId: TENANT });
});

describe('addContact', () => {
  it('stores all fields', async () => {
    const result = await runTool(tools.addContact, {
      type: 'customer',
      name: 'Bu Rina',
      phone: '081234567890',
      email: 'rina@example.com',
      notes: 'suka beli sabun batang, bayar cash',
    });
    expect(result.id).toBeGreaterThan(0);
    expect(result.type).toBe('customer');
    expect(result.phone).toBe('081234567890');
    expect(result.email).toBe('rina@example.com');
    expect(result.notes).toMatch(/sabun/);
  });

  it('stores with only required fields', async () => {
    const result = await runTool(tools.addContact, { type: 'supplier', name: 'CV Maju Jaya' });
    expect(result.phone).toBeNull();
    expect(result.email).toBeNull();
    expect(result.notes).toBeNull();
  });
});

describe('listContacts', () => {
  it('filters by type', async () => {
    await runTool(tools.addContact, { type: 'customer', name: 'Bu Rina' });
    await runTool(tools.addContact, { type: 'supplier', name: 'CV Maju Jaya' });
    await runTool(tools.addContact, { type: 'other', name: 'Notaris Pak Hadi' });
    const { contacts } = await runTool(tools.listContacts, { limit: 10, type: 'supplier' });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.name).toBe('CV Maju Jaya');
  });

  it('searches by case-insensitive substring', async () => {
    await runTool(tools.addContact, { type: 'customer', name: 'Bu Rina Wahyuni' });
    await runTool(tools.addContact, { type: 'customer', name: 'Pak Dedi' });
    const { contacts } = await runTool(tools.listContacts, { limit: 10, search: 'rina' });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.name).toBe('Bu Rina Wahyuni');
  });

  it('sorts alphabetically', async () => {
    await runTool(tools.addContact, { type: 'customer', name: 'Cahaya' });
    await runTool(tools.addContact, { type: 'customer', name: 'Ani' });
    await runTool(tools.addContact, { type: 'customer', name: 'Budi' });
    const { contacts } = await runTool(tools.listContacts, { limit: 10 });
    expect(contacts.map((c) => c.name)).toEqual(['Ani', 'Budi', 'Cahaya']);
  });

  it('scopes by tenant', async () => {
    await runTool(tools.addContact, { type: 'customer', name: 'milik A' });
    const other = createContactTools({ db, tenantId: 'tenant-B' });
    const { contacts } = await runTool(other.listContacts, { limit: 10 });
    expect(contacts).toHaveLength(0);
  });
});
