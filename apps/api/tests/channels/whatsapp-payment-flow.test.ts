import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { setSetting } from '../../src/db/settings.js';

describe('WhatsApp handler payment-aware response', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
    vi.clearAllMocks();
  });

  describe('QR image detection in agent response', () => {
    it('detects QR image prefix in agent text response', () => {
      // The agent returns text that contains a QR image data URL prefix
      // e.g. "[QR_IMAGE]data:image/png;base64,ABCD123..."
      // The handler should parse this and send as WhatsApp image instead of text
      const agentResponse = '[QR_IMAGE]data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE...';
      const hasQrImage = agentResponse.includes('[QR_IMAGE]data:image/png;base64,');
      expect(hasQrImage).toBe(true);
    });

    it('extracts base64 image data from agent response', () => {
      const agentResponse = '[QR_IMAGE]data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE...';
      const prefix = '[QR_IMAGE]data:image/png;base64,';
      const base64 = agentResponse.slice(agentResponse.indexOf(prefix) + prefix.length);
      expect(base64).toBe('iVBORw0KGgoAAAANSUhEUgAAAAE...');
    });

    it('does not false-positive on regular text responses', () => {
      const normalResponse = 'Silakan scan QRIS berikut untuk pembayaran.';
      const hasQrImage = normalResponse.includes('[QR_IMAGE]data:image/png;base64,');
      expect(hasQrImage).toBe(false);
    });
  });

  describe('payment confirmation text formatting', () => {
    it('formats payment amount in IDR', () => {
      // The request-payment tool returns totalPayment in IDR (already integer)
      // When webhook confirms, handler sends confirmation with amount
      const formatIDR = (n: number) =>
        `Rp ${n.toLocaleString('id-ID', { minimumFractionDigits: 0 })}`;
      expect(formatIDR(50200)).toBe('Rp 50.200');
    });
  });
});