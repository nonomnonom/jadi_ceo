import { describe, it, expect } from 'vitest';

describe('InvoiceAgent', () => {
  it('has id invoice-agent', async () => {
    const { invoiceAgent } = await import('../../src/mastra/agents/invoice-agent.js');
    expect(invoiceAgent.id).toBe('invoice-agent');
  });

  it('has name Invoice Agent', async () => {
    const { invoiceAgent } = await import('../../src/mastra/agents/invoice-agent.js');
    expect(invoiceAgent.name).toBe('Invoice Agent');
  });

  it('uses the correct model', async () => {
    const { invoiceAgent } = await import('../../src/mastra/agents/invoice-agent.js');
    expect(invoiceAgent.model).toBe('openrouter/anthropic/claude-sonnet-4-6');
  });
});
