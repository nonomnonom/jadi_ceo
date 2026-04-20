import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { createContactTools } from '../../src/mastra/tools/contacts.js';
import { createInvoiceTools } from '../../src/mastra/tools/invoices.js';
import { runTool } from '../run-tool.js';

const TENANT = 'test-tenant';

let db: Db;
let invoiceTools: ReturnType<typeof createInvoiceTools>;
let contactTools: ReturnType<typeof createContactTools>;

beforeEach(async () => {
  db = createDb(':memory:');
  await initSchema(db);
  invoiceTools = createInvoiceTools({ db, tenantId: TENANT });
  contactTools = createContactTools({ db, tenantId: TENANT });
});

async function yesterdayIso(): Promise<string> {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().replace('Z', '+00:00');
}

async function tomorrowIso(): Promise<string> {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().replace('Z', '+00:00');
}

describe('createInvoice', () => {
  it('creates an invoice linked to a contact with pending status', async () => {
    const c = await runTool(contactTools.addContact, { type: 'customer', name: 'Bu Rina' });
    const inv = await runTool(invoiceTools.createInvoice, {
      contactId: c.id,
      amountIdr: 500000,
      description: 'pesanan sabun 50 pcs',
      dueAt: await tomorrowIso(),
    });
    expect(inv.contactId).toBe(c.id);
    expect(inv.contactName).toBe('Bu Rina');
    expect(inv.amountIdr).toBe(500000);
    expect(inv.amountFormatted).toBe('Rp 500.000');
    expect(inv.status).toBe('pending');
    expect(inv.paidAt).toBeNull();
  });

  it('supports invoices without a contact', async () => {
    const inv = await runTool(invoiceTools.createInvoice, {
      amountIdr: 75000,
    });
    expect(inv.contactId).toBeNull();
    expect(inv.contactName).toBeNull();
    expect(inv.status).toBe('pending');
  });

  it('rejects unknown contactId', async () => {
    await expect(
      runTool(invoiceTools.createInvoice, { contactId: 9999, amountIdr: 100000 }),
    ).rejects.toThrow(/tidak ditemukan/);
  });

  it('computes status=overdue when dueAt is in the past', async () => {
    const inv = await runTool(invoiceTools.createInvoice, {
      amountIdr: 200000,
      dueAt: await yesterdayIso(),
    });
    expect(inv.status).toBe('overdue');
  });
});

describe('listInvoices', () => {
  it('default lists only unpaid invoices and totals outstanding', async () => {
    await runTool(invoiceTools.createInvoice, { amountIdr: 100000 });
    await runTool(invoiceTools.createInvoice, { amountIdr: 250000 });
    const paid = await runTool(invoiceTools.createInvoice, { amountIdr: 50000 });
    await runTool(invoiceTools.markInvoicePaid, { invoiceId: paid.id, recordTransaction: false });

    const { invoices, totalOutstandingIdr, totalOutstandingFormatted } = await runTool(
      invoiceTools.listInvoices,
      { limit: 10 },
    );
    expect(invoices).toHaveLength(2);
    expect(totalOutstandingIdr).toBe(350000);
    expect(totalOutstandingFormatted).toBe('Rp 350.000');
  });

  it('filters by status=overdue', async () => {
    await runTool(invoiceTools.createInvoice, { amountIdr: 100000, dueAt: await tomorrowIso() });
    await runTool(invoiceTools.createInvoice, { amountIdr: 200000, dueAt: await yesterdayIso() });
    const { invoices } = await runTool(invoiceTools.listInvoices, { limit: 10, status: 'overdue' });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.amountIdr).toBe(200000);
    expect(invoices[0]?.status).toBe('overdue');
  });

  it('filters by status=paid', async () => {
    const a = await runTool(invoiceTools.createInvoice, { amountIdr: 100000 });
    await runTool(invoiceTools.createInvoice, { amountIdr: 200000 });
    await runTool(invoiceTools.markInvoicePaid, { invoiceId: a.id, recordTransaction: false });
    const { invoices } = await runTool(invoiceTools.listInvoices, { limit: 10, status: 'paid' });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.amountIdr).toBe(100000);
  });

  it('filters by contactId', async () => {
    const c1 = await runTool(contactTools.addContact, { type: 'customer', name: 'A' });
    const c2 = await runTool(contactTools.addContact, { type: 'customer', name: 'B' });
    await runTool(invoiceTools.createInvoice, { contactId: c1.id, amountIdr: 100000 });
    await runTool(invoiceTools.createInvoice, { contactId: c2.id, amountIdr: 200000 });
    const { invoices } = await runTool(invoiceTools.listInvoices, { limit: 10, contactId: c1.id });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]?.contactName).toBe('A');
  });
});

describe('markInvoicePaid', () => {
  it('marks paid and optionally records an income transaction', async () => {
    const inv = await runTool(invoiceTools.createInvoice, {
      amountIdr: 150000,
      description: 'Bu Rina pesanan #12',
    });
    const result = await runTool(invoiceTools.markInvoicePaid, { invoiceId: inv.id });
    expect(result.status).toBe('paid');
    expect(result.paidAt).toBeGreaterThan(0);
    expect(result.transactionId).not.toBeNull();

    const txCheck = await db.execute({
      sql: 'SELECT kind, amount_idr, description FROM transactions WHERE id = ?',
      args: [result.transactionId ?? -1],
    });
    const tx = txCheck.rows[0];
    expect(tx).toBeDefined();
    expect(tx?.kind).toBe('income');
    expect(Number(tx?.amount_idr)).toBe(150000);
    expect(String(tx?.description)).toMatch(/Bu Rina pesanan #12/);
  });

  it('skips transaction recording when recordTransaction=false', async () => {
    const inv = await runTool(invoiceTools.createInvoice, { amountIdr: 100000 });
    const result = await runTool(invoiceTools.markInvoicePaid, {
      invoiceId: inv.id,
      recordTransaction: false,
    });
    expect(result.transactionId).toBeNull();

    const txCheck = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM transactions' });
    expect(Number(txCheck.rows[0]?.c ?? 0)).toBe(0);
  });

  it('rejects double-paying the same invoice', async () => {
    const inv = await runTool(invoiceTools.createInvoice, { amountIdr: 100000 });
    await runTool(invoiceTools.markInvoicePaid, { invoiceId: inv.id, recordTransaction: false });
    await expect(
      runTool(invoiceTools.markInvoicePaid, { invoiceId: inv.id, recordTransaction: false }),
    ).rejects.toThrow(/sudah.*lunas/i);
  });
});
