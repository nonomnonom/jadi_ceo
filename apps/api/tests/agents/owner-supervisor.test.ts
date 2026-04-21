import { describe, it, expect } from 'vitest';

describe('OwnerSupervisor', () => {
  it('has id owner-supervisor', async () => {
    const { ownerSupervisor } = await import('../../src/mastra/agents/owner-supervisor.js');
    expect(ownerSupervisor.id).toBe('owner-supervisor');
  });

  it('has name Owner Supervisor', async () => {
    const { ownerSupervisor } = await import('../../src/mastra/agents/owner-supervisor.js');
    expect(ownerSupervisor.name).toBe('Owner Supervisor');
  });

  it('uses the correct model', async () => {
    const { ownerSupervisor } = await import('../../src/mastra/agents/owner-supervisor.js');
    expect(ownerSupervisor.model).toBe('openrouter/anthropic/claude-sonnet-4-6');
  });
});
