import { describe, it, expect, beforeEach } from 'vitest';
import { apiRoutes } from '../../src/mastra/api-routes.js';
import { resetWhatsAppManager } from '../../src/channels/whatsapp-manager.js';

describe('WhatsApp API routes', () => {
  beforeEach(() => {
    resetWhatsAppManager();
  });

  it('registers GET /custom/whatsapp/qr route', () => {
    const qrRoute = apiRoutes.find((r) => r.path === '/custom/whatsapp/qr' && r.method === 'GET');
    expect(qrRoute).toBeDefined();
  });

  it('registers POST /custom/whatsapp/connect route', () => {
    const connectRoute = apiRoutes.find(
      (r) => r.path === '/custom/whatsapp/connect' && r.method === 'POST',
    );
    expect(connectRoute).toBeDefined();
  });

  it('registers POST /custom/whatsapp/disconnect route', () => {
    const disconnectRoute = apiRoutes.find(
      (r) => r.path === '/custom/whatsapp/disconnect' && r.method === 'POST',
    );
    expect(disconnectRoute).toBeDefined();
  });

  it('registers GET /custom/whatsapp/status route', () => {
    const statusRoute = apiRoutes.find(
      (r) => r.path === '/custom/whatsapp/status' && r.method === 'GET',
    );
    expect(statusRoute).toBeDefined();
  });
});
