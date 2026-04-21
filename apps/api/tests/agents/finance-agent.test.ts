import { describe, it, expect } from 'vitest';

describe('FinanceAgent', () => {
  it('has id finance-agent', async () => {
    const { financeAgent } = await import('../../src/mastra/agents/finance-agent.js');
    expect(financeAgent.id).toBe('finance-agent');
  });

  it('has name Finance Agent', async () => {
    const { financeAgent } = await import('../../src/mastra/agents/finance-agent.js');
    expect(financeAgent.name).toBe('Finance Agent');
  });

  it('uses the correct model', async () => {
    const { financeAgent } = await import('../../src/mastra/agents/finance-agent.js');
    expect(financeAgent.model).toBe('openrouter/anthropic/claude-sonnet-4-6');
  });
});
