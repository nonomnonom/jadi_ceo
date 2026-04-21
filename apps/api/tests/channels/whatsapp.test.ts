import { describe, it, expect } from 'vitest';
import { WhatsAppChannel } from '../../src/channels/whatsapp.js';

describe('WhatsAppChannel', () => {
  it('exports WhatsAppChannel', () => {
    expect(typeof WhatsAppChannel).toBe('function');
  });
});
