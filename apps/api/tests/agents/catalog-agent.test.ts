import { describe, it, expect } from 'vitest';

describe('CatalogAgent', () => {
  it('has id catalog-agent', async () => {
    const { catalogAgent } = await import('../../src/mastra/agents/catalog-agent.js');
    expect(catalogAgent.id).toBe('catalog-agent');
  });

  it('has name Catalog Agent', async () => {
    const { catalogAgent } = await import('../../src/mastra/agents/catalog-agent.js');
    expect(catalogAgent.name).toBe('Catalog Agent');
  });

  it('uses the correct model', async () => {
    const { catalogAgent } = await import('../../src/mastra/agents/catalog-agent.js');
    expect(catalogAgent.model).toBe('openrouter/anthropic/claude-sonnet-4-6');
  });
});
