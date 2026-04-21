import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';

describe('Phase 1-3 schema tables', () => {
  beforeAll(async () => {
    const db = getDb();
    await initSchema(db);
  });

  describe('agent_settings table', () => {
    it('creates agent_settings table', async () => {
      const db = getDb();
      const result = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_settings'"
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('has required columns', async () => {
      const db = getDb();
      const info = await db.execute('PRAGMA table_info(agent_settings)');
      const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('key');
      expect(columns).toContain('value');
    });
  });

  describe('orders table', () => {
    it('creates orders table', async () => {
      const db = getDb();
      const result = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='orders'"
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('has required columns', async () => {
      const db = getDb();
      const info = await db.execute('PRAGMA table_info(orders)');
      const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('customer_phone');
      expect(columns).toContain('product_id');
      expect(columns).toContain('qty');
      expect(columns).toContain('total_idr');
      expect(columns).toContain('status');
    });

    it('has payment_id and payment_status columns', async () => {
      const db = getDb();
      const info = await db.execute('PRAGMA table_info(orders)');
      const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
      expect(columns).toContain('payment_id');
      expect(columns).toContain('payment_status');
    });
  });

  describe('conversations table', () => {
    it('creates conversations table', async () => {
      const db = getDb();
      const result = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'"
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('has required columns', async () => {
      const db = getDb();
      const info = await db.execute('PRAGMA table_info(conversations)');
      const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('channel');
      expect(columns).toContain('customer_phone');
      expect(columns).toContain('direction');
      expect(columns).toContain('message');
    });
  });

  describe('expense_categories table', () => {
    it('creates expense_categories table', async () => {
      const db = getDb();
      const result = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='expense_categories'"
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('has required columns', async () => {
      const db = getDb();
      const info = await db.execute('PRAGMA table_info(expense_categories)');
      const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('name');
    });
  });

  describe('memory table', () => {
    it('creates memory table', async () => {
      const db = getDb();
      const result = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='memory'"
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('has required columns', async () => {
      const db = getDb();
      const info = await db.execute('PRAGMA table_info(memory)');
      const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('content');
    });
  });

  describe('memory_recalls table', () => {
    it('creates memory_recalls table', async () => {
      const db = getDb();
      const result = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_recalls'"
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('has required columns', async () => {
      const db = getDb();
      const info = await db.execute('PRAGMA table_info(memory_recalls)');
      const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
      expect(columns).toContain('memory_id');
      expect(columns).toContain('recall_count');
    });
  });

  describe('tool_approvals table', () => {
    it('creates tool_approvals table', async () => {
      const db = getDb();
      const result = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_approvals'"
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('has required columns', async () => {
      const db = getDb();
      const info = await db.execute('PRAGMA table_info(tool_approvals)');
      const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('tool_name');
      expect(columns).toContain('approved');
    });
  });

  describe('payments table (Phase 2B)', () => {
    it('creates payments table', async () => {
      const db = getDb();
      const result = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='payments'"
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('has required columns per SPEC.md', async () => {
      const db = getDb();
      const info = await db.execute('PRAGMA table_info(payments)');
      const columns = info.rows.map((r: Record<string, unknown>) => r.name as string);
      expect(columns).toContain('tenant_id');
      expect(columns).toContain('order_id');
      expect(columns).toContain('amount_idr');
      expect(columns).toContain('payment_method');
      expect(columns).toContain('status');
    });
  });
});
