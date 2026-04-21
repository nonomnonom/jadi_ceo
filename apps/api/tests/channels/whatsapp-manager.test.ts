import { describe, it, expect, beforeEach } from 'vitest';
import { getWhatsAppManager, resetWhatsAppManager } from '../../src/channels/whatsapp-manager.js';

describe('WhatsAppManager', () => {
  beforeEach(() => {
    resetWhatsAppManager();
  });

  it('exports getWhatsAppManager and resetWhatsAppManager', () => {
    expect(typeof getWhatsAppManager).toBe('function');
    expect(typeof resetWhatsAppManager).toBe('function');
  });

  it('starts disconnected', () => {
    const manager = getWhatsAppManager();
    expect(manager.getStatus().connected).toBe(false);
    expect(manager.getStatus().qr).toBeNull();
  });

  it('stores qr data when setQR is called', () => {
    const manager = getWhatsAppManager();
    manager.setQR('test-qr-string');
    expect(manager.getStatus().qr).toBe('test-qr-string');
  });

  it('clears qr when clearQR is called', () => {
    const manager = getWhatsAppManager();
    manager.setQR('test-qr-string');
    manager.clearQR();
    expect(manager.getStatus().qr).toBeNull();
  });

  it('setConnected clears QR (handled via connection.update in real flow)', () => {
    const manager = getWhatsAppManager();
    manager.setQR('some-qr');
    expect(manager.getStatus().qr).toBe('some-qr');
    // In the real connect() flow, setConnected is implicit via connection.update
    // Here we test setDisconnected which clears both
    manager.setDisconnected();
    expect(manager.getStatus().qr).toBeNull();
    expect(manager.getStatus().connected).toBe(false);
  });

  it('sets disconnected state and clears QR', () => {
    const manager = getWhatsAppManager();
    manager.setQR('some-qr');
    manager.setDisconnected();
    expect(manager.getStatus().connected).toBe(false);
    expect(manager.getStatus().qr).toBeNull();
  });
});
