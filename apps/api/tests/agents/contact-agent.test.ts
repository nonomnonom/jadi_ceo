import { describe, it, expect } from 'vitest';

describe('ContactAgent', () => {
  it('has id contact-agent', async () => {
    const { contactAgent } = await import('../../src/mastra/agents/contact-agent.js');
    expect(contactAgent.id).toBe('contact-agent');
  });

  it('has name Contact Agent', async () => {
    const { contactAgent } = await import('../../src/mastra/agents/contact-agent.js');
    expect(contactAgent.name).toBe('Contact Agent');
  });

  it('uses the correct model', async () => {
    const { contactAgent } = await import('../../src/mastra/agents/contact-agent.js');
    expect(contactAgent.model).toBe('openrouter/anthropic/claude-sonnet-4-6');
  });
});
